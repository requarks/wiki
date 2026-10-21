import crypto from 'node:crypto'
import {
  groups as groupsTable,
  oauthClients as oauthClientsTable,
  personalTokens as personalTokensTable,
  userGroups,
  users as usersTable
} from '../db/schema.ts'
import { and, desc, eq, sql } from 'drizzle-orm'
import { flatten, uniq } from 'es-toolkit/array'
import { epochSeconds } from '../helpers/jwt.ts'
import { ApiKeyError, KEY_EXPIRATIONS, PERSONAL_TOKEN_AUDIENCE } from './apiKeys.ts'
import type { ApiKeyIdentity, KeyExpiration } from './apiKeys.ts'
import type { JwtClaims } from '../helpers/jwt.ts'

/**
 * What a personal token can be given access to, one category per area of the API.
 *
 * Content and the user's own profile, and nothing else: there is no category for anything under the
 * administration area, so no token reaches it whatever its owner may do there. Automating the admin
 * area is what system API keys are for, and keeping elevated permissions out of a token sitting in
 * somebody's CI configuration is the point of the split.
 *
 * `mcp` is the one category that names a SURFACE rather than an area: no `/_api` route declares it,
 * and every tool on `/_mcp` requires it on top of its own category (`controllers/mcp.ts`). Without it
 * a token is refused there outright; at `read` an agent holding the token may only call read-only
 * tools, whatever the token's other scopes allow — the one switch that keeps an agent read-only.
 */
export const TOKEN_SCOPE_CATEGORIES = [
  'pages',
  'assets',
  'comments',
  'glossary',
  'navigation',
  'approvals',
  'profile',
  'mcp'
] as const
export type TokenScopeCategory = (typeof TOKEN_SCOPE_CATEGORIES)[number]

/** `write` includes `read`: a token that may change something may also look at it. */
export const TOKEN_SCOPE_LEVELS = ['read', 'write'] as const
export type TokenScopeLevel = (typeof TOKEN_SCOPE_LEVELS)[number]

/** A scope a token holds, e.g. `pages:write`. */
export type TokenScope = `${TokenScopeCategory}:${TokenScopeLevel}`

/**
 * What a route declares as its `config.scope`.
 *
 * The bare category is the usual form, and takes its level from the method: GET and HEAD read,
 * everything else writes. The explicit form is for a route whose method says the wrong thing — a
 * POST that only answers a question.
 */
export type RouteScope = TokenScopeCategory | TokenScope

export const TOKEN_SCOPES = TOKEN_SCOPE_CATEGORIES.flatMap((category) =>
  TOKEN_SCOPE_LEVELS.map((level) => `${category}:${level}` as TokenScope)
)

/** Enough for every script and integration a person could reasonably run, and a bound on the table. */
export const MAX_TOKENS_PER_USER = 50

/** How often, at most, a token's `lastUsedAt` is written by one instance. */
const TOUCH_INTERVAL_MS = 5 * 60 * 1000

/**
 * The scope a request needs on a route, or null when the route declares none and no token may use it.
 */
export function requiredScope(
  routeScope: RouteScope | undefined,
  method: string
): TokenScope | null {
  if (!routeScope) {
    return null
  }
  if (routeScope.includes(':')) {
    return routeScope as TokenScope
  }
  const level: TokenScopeLevel = method === 'GET' || method === 'HEAD' ? 'read' : 'write'
  return `${routeScope as TokenScopeCategory}:${level}`
}

/** Whether a set of scopes covers the one asked for. */
export function grantsScope(scopes: TokenScope[], required: TokenScope): boolean {
  if (scopes.includes(required)) {
    return true
  }
  const [category, level] = required.split(':')
  return level === 'read' && scopes.includes(`${category}:write` as TokenScope)
}

/**
 * At most one scope per category, write taking the place of read, in the order the categories are
 * declared. Anything that is not a scope is dropped — the API schema refuses it before this is
 * reached, so it is a guarantee about what is stored rather than a validation.
 */
export function normalizeScopes(scopes: string[]): TokenScope[] {
  const result: TokenScope[] = []
  for (const category of TOKEN_SCOPE_CATEGORIES) {
    if (scopes.includes(`${category}:write`)) {
      result.push(`${category}:write`)
    } else if (scopes.includes(`${category}:read`)) {
      result.push(`${category}:read`)
    }
  }
  return result
}

/** A personal token as exposed by the API. Never includes the token itself, which is not stored. */
export interface PersonalToken {
  id: string
  name: string
  keyShort: string
  scopes: TokenScope[]
  expiration: Date
  lastUsedAt: Date | null
  createdAt: Date
  /**
   * Issued before the signing certificates were last regenerated, so its signature no longer
   * verifies. See `ApiKeys.getKeys`, which marks API keys the same way.
   */
  isInvalidated: boolean
  /**
   * The MCP client this was granted to through OAuth, for a connection rather than a token made by
   * hand. Null for every token made under Profile → Access Tokens.
   */
  client: { id: string; name: string } | null
}

/** Raised by `create()` for a request the caller can correct, with a message safe to return. */
export class PersonalTokenError extends Error {}

const tokenSelection = {
  id: personalTokensTable.id,
  name: personalTokensTable.name,
  keyShort: personalTokensTable.keyShort,
  scopes: personalTokensTable.scopes,
  expiration: personalTokensTable.expiration,
  lastUsedAt: personalTokensTable.lastUsedAt,
  createdAt: personalTokensTable.createdAt,
  clientId: personalTokensTable.clientId,
  clientName: oauthClientsTable.name
}

/**
 * Personal Access Tokens model
 *
 * An API key belonging to a user: an RS256 JWT signed with the same installation keypair, verified
 * by the same hook, and refused or accepted on the same row-per-request basis. What differs is who it
 * acts as. A system key acts for the groups it was issued for and is nobody; a personal token acts AS
 * its owner — their groups and page rules, resolved on every request, and their name on whatever it
 * writes — narrowed to the scopes it was created with. That is what lets it do the things that need
 * an author: saving a page, posting a comment.
 *
 * Its own audience (`PERSONAL_TOKEN_AUDIENCE`) is what tells the two apart at verification, so a
 * system key cannot be presented as somebody's personal token or the other way round.
 */
class PersonalTokens {
  /** When each token's `lastUsedAt` was last written by this instance, in epoch milliseconds. */
  #touchedAt = new Map<string, number>()

  /**
   * A user's tokens, newest first. Expired ones are kept, so that their owner sees why one stopped
   * working and can delete it.
   */
  async listForUser(userId: string): Promise<PersonalToken[]> {
    const rows = await WIKI.db
      .select(tokenSelection)
      .from(personalTokensTable)
      .leftJoin(oauthClientsTable, eq(oauthClientsTable.id, personalTokensTable.clientId))
      .where(eq(personalTokensTable.userId, userId))
      .orderBy(desc(personalTokensTable.createdAt))
    const generatedAt = Temporal.Instant.from(WIKI.models.apiKeys.certificatesGeneratedAt())
    return rows.map(({ clientId, clientName, ...row }: any) => ({
      ...row,
      scopes: normalizeScopes(row.scopes ?? []),
      isInvalidated: Temporal.Instant.compare(row.createdAt.toTemporalInstant(), generatedAt) < 0,
      client: clientId ? { id: clientId, name: clientName ?? '' } : null
    }))
  }

  /**
   * Mint a new token for a user.
   *
   * @param expiration One of the lifetimes an API key can be given (`KEY_EXPIRATIONS`), counted from
   *                   now — the same choice, so that the two kinds of key read alike
   * @returns The row's ID plus the token, which is the only time it exists outside the client
   * @throws PersonalTokenError for no scopes, or a user at the limit
   */
  async create({
    userId,
    name,
    expiration,
    scopes
  }: {
    userId: string
    name: string
    expiration: KeyExpiration
    scopes: string[]
  }): Promise<{ id: string; token: string }> {
    const now = Temporal.Now.instant()
    const expiresAt = now.toZonedDateTimeISO('UTC').add(KEY_EXPIRATIONS[expiration]).toInstant()

    const normalized = normalizeScopes(scopes)
    if (normalized.length < 1) {
      throw new PersonalTokenError('A personal access token needs at least one scope.')
    }

    const count = await WIKI.db.$count(personalTokensTable, eq(personalTokensTable.userId, userId))
    if (count >= MAX_TOKENS_PER_USER) {
      throw new PersonalTokenError(
        `An account can hold at most ${MAX_TOKENS_PER_USER} personal access tokens. Delete one you no longer use first.`
      )
    }

    const id = crypto.randomUUID()
    const token = WIKI.models.apiKeys.sign({
      id,
      sub: userId,
      aud: PERSONAL_TOKEN_AUDIENCE,
      iat: epochSeconds(now),
      exp: epochSeconds(expiresAt)
    })

    await WIKI.db.insert(personalTokensTable).values({
      id,
      userId,
      name,
      keyShort: token.slice(-8),
      scopes: normalized,
      expiration: new Date(expiresAt.epochMilliseconds)
    })

    return { id, token }
  }

  /**
   * Delete one of a user's tokens. Tokens already handed out stop working on the next request.
   *
   * Scoped to the owner, so that a token ID alone — which the admin area shows — can never be used to
   * reach somebody else's.
   *
   * @returns The name of the deleted token, or null if the user has no such token
   */
  async remove(userId: string, tokenId: string): Promise<string | null> {
    const rows = await WIKI.db
      .delete(personalTokensTable)
      .where(and(eq(personalTokensTable.id, tokenId), eq(personalTokensTable.userId, userId)))
      .returning({ name: personalTokensTable.name })
    this.#touchedAt.delete(tokenId)
    return rows[0]?.name ?? null
  }

  /**
   * Resolve the claims of a verified token into what it grants. Called by `ApiKeys.verify` once the
   * signature has checked out and the audience has said this is a personal token.
   *
   * @throws ApiKeyError with a reason suitable for a 401 response
   */
  async verifyClaims(claims: JwtClaims): Promise<ApiKeyIdentity> {
    // -> Switching the feature off switches the tokens off, not only the button that makes them: an
    //    administrator turning this off wants what is out there to stop working. The rows are kept,
    //    and work again if it is turned back on.
    if (!WIKI.models.authentication.arePersonalTokensAllowed()) {
      throw new ApiKeyError('Personal access tokens are disabled on this wiki.')
    }
    if (typeof claims.id !== 'string' || typeof claims.sub !== 'string') {
      throw new ApiKeyError('Token is not a personal access token.')
    }

    const rows = await WIKI.db
      .select({
        userId: personalTokensTable.userId,
        scopes: personalTokensTable.scopes,
        expiration: personalTokensTable.expiration,
        clientId: personalTokensTable.clientId,
        email: usersTable.email,
        name: usersTable.name,
        hasAvatar: usersTable.hasAvatar,
        prefs: usersTable.prefs,
        isActive: usersTable.isActive
      })
      .from(personalTokensTable)
      .innerJoin(usersTable, eq(usersTable.id, personalTokensTable.userId))
      .where(eq(personalTokensTable.id, claims.id))
      .limit(1)
    const row = rows[0]
    // -> A deleted token, or one whose row names another user than the token does — which nothing
    //    can produce short of the signing key, and is refused all the same
    if (!row || row.userId !== claims.sub) {
      throw new ApiKeyError('Personal access token does not exist or has been revoked.')
    }
    if (Temporal.Instant.compare(row.expiration.toTemporalInstant(), Temporal.Now.instant()) <= 0) {
      throw new ApiKeyError('Personal access token has expired.')
    }
    if (!row.isActive) {
      throw new ApiKeyError('The account this personal access token belongs to is deactivated.')
    }

    // -> The owner's groups as they are NOW, so that taking somebody out of a group narrows their
    //    tokens at once rather than at their next login
    const groups = await WIKI.db
      .select({ id: groupsTable.id, permissions: groupsTable.permissions })
      .from(userGroups)
      .innerJoin(groupsTable, eq(groupsTable.id, userGroups.groupId))
      .where(eq(userGroups.userId, row.userId))

    this.#touch(claims.id)

    const prefs = (row.prefs ?? {}) as Record<string, any>
    return {
      kind: 'personal',
      id: claims.id,
      groupIds: groups.map((g: any) => g.id),
      permissions: uniq(flatten(groups.map((g: any) => (g.permissions ?? []) as string[]))),
      // -> The same fields `users.updateSession` copies onto a session, so that a route reading the
      //    user cannot tell which of the two it was handed
      user: {
        id: row.userId,
        email: row.email,
        name: row.name,
        hasAvatar: row.hasAvatar,
        locale: prefs.locale,
        timezone: prefs.timezone,
        dateFormat: prefs.dateFormat,
        timeFormat: prefs.timeFormat,
        appearance: prefs.appearance,
        cvd: prefs.cvd,
        reduceMotion: prefs.reduceMotion,
        underlineLinks: prefs.underlineLinks,
        contentTextSize: prefs.contentTextSize
      },
      scopes: normalizeScopes((row.scopes ?? []) as string[]),
      oauthClientId: row.clientId ?? null
    }
  }

  /**
   * Record that a token was used — at most every few minutes per instance, and never on the request's
   * time. It is a hint for its owner about which tokens are still in use, not an access log, so an
   * instance that restarts and writes it again early costs nothing.
   */
  #touch(tokenId: string): void {
    const now = Date.now()
    if (now - (this.#touchedAt.get(tokenId) ?? 0) < TOUCH_INTERVAL_MS) {
      return
    }
    this.#touchedAt.set(tokenId, now)
    WIKI.db
      .update(personalTokensTable)
      .set({ lastUsedAt: sql`now()` })
      .where(eq(personalTokensTable.id, tokenId))
      .catch((err: any) => {
        WIKI.logger.warn(`Failed to record the use of a personal access token: ${err.message}`)
      })
  }
}

export const personalTokens = new PersonalTokens()
