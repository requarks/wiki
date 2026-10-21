import crypto from 'node:crypto'
import { and, count, eq, lt, notExists, sql } from 'drizzle-orm'
import { validate as uuidValidate } from 'uuid'
import {
  oauthClients as clientsTable,
  oauthCodes as codesTable,
  personalTokens as tokensTable,
  users as usersTable
} from '../db/schema.ts'
import { timingSafeCompare } from '../helpers/common.ts'
import { epochSeconds } from '../helpers/jwt.ts'
import { KEY_EXPIRATIONS, PERSONAL_TOKEN_AUDIENCE } from './apiKeys.ts'
import { MAX_TOKENS_PER_USER, normalizeScopes, TOKEN_SCOPES } from './personalTokens.ts'
import type { KeyExpiration } from './apiKeys.ts'
import type { TokenScope } from './personalTokens.ts'

/**
 * A refusal in the OAuth flow, with the error code RFC 6749 gives it.
 *
 * `redirectable` says whether the client may be told through its redirect URI. It may not when the
 * client or the redirect URI is what is wrong: sending the browser to an address the request itself
 * named, for a client that does not exist, is how an authorization server becomes an open redirect.
 */
export class OAuthError extends Error {
  error: string
  status: number
  redirectable: boolean
  constructor(error: string, message: string, { status = 400, redirectable = false } = {}) {
    super(message)
    this.error = error
    this.status = status
    this.redirectable = redirectable
  }
}

/** What the token endpoint answers with, as RFC 6749 §5.1 shapes it. */
export interface TokenResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_token: string
  scope: string
}

/** A client as the admin area and the consent screen see it. */
export interface OAuthClient {
  id: string
  name: string
  redirectUris: string[]
  createdAt: Date
}

/** An authorization request, checked. What the consent screen shows and the code is made from. */
export interface AuthorizationRequest {
  client: OAuthClient
  redirectUri: string
  codeChallenge: string
  state: string | null
  scopes: TokenScope[]
}

/** An access token's life. A grant lasts as long as the consent screen said; this is per token. */
export const ACCESS_TOKEN_TTL_SECONDS = 3600
/** How long a code waits to be exchanged — the length of a redirect, generously. */
const CODE_TTL_SECONDS = 600
/** How long a client that no grant ever named is kept: registration is open, so it must not pile up. */
const UNUSED_CLIENT_TTL_HOURS = 24
const MAX_REDIRECT_URIS = 10

/** What a grant starts from when a client asks for nothing: reading the wiki, and only reading. */
export const DEFAULT_GRANT_SCOPES: TokenScope[] = ['mcp:read', 'pages:read', 'glossary:read']

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function randomSecret(): string {
  return crypto.randomBytes(32).toString('base64url')
}

/** RFC 7636 S256: the challenge is the base64url SHA-256 of the verifier. */
function pkceMatches(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) {
    return false
  }
  const computed = crypto.createHash('sha256').update(verifier).digest('base64url')
  return timingSafeCompare(computed, challenge)
}

/**
 * Whether a redirect URI may be registered.
 *
 * `https` anywhere; `http` only on the loopback interface, which is what a CLI or a desktop client
 * listens on (RFC 8252 §7.3); and a private-use scheme for a native app (§7.1) — anything but the
 * schemes a browser would run or read from disk. No fragment, as RFC 6749 §3.1.2 requires.
 */
export function isAllowedRedirectUri(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.hash || value.length > 2048) {
    return false
  }
  const scheme = url.protocol.slice(0, -1).toLowerCase()
  if (scheme === 'https') {
    return true
  }
  if (scheme === 'http') {
    return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  }
  return !['javascript', 'data', 'vbscript', 'file', 'blob', 'about', 'ftp', 'ws', 'wss'].includes(
    scheme
  )
}

/**
 * OAuth model
 *
 * The wiki as its own OAuth 2.1 authorization server, for the MCP clients that cannot be handed a
 * header — the remote connectors in claude.ai and ChatGPT. See `dev/specs/mcp.md` §4.3, and
 * `controllers/oauth.ts` for the endpoints.
 *
 * **A grant is a personal access token** made by a consent screen instead of by the create dialog: a
 * `personalTokens` row with a `clientId`, the same owner, scopes and `verifyClaims`, listed and
 * deleted under Profile → Access Tokens like any other. What OAuth adds is around it: the client
 * that registered, the code a consent produces, hour-long access tokens, and a refresh token that
 * rotates on every use.
 *
 * Everything is in the database, so any instance of an HA set answers any step of the flow.
 */
class OAuth {
  /** The protected resource every grant is for, and the only one a grant's token reaches. */
  resourceFor(origin: string): string {
    return `${origin}/_mcp`
  }

  /** Whether the flow is offered at all: it exists to connect MCP clients. */
  isAvailable(): boolean {
    return (
      WIKI.models.mcp.isEnabled() &&
      WIKI.config.api?.isEnabled === true &&
      WIKI.models.authentication.arePersonalTokensAllowed()
    )
  }

  /** RFC 8414 authorization server metadata. */
  serverMetadata(origin: string) {
    return {
      issuer: origin,
      authorization_endpoint: `${origin}/_oauth/authorize`,
      token_endpoint: `${origin}/_oauth/token`,
      registration_endpoint: `${origin}/_oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: TOKEN_SCOPES
    }
  }

  /** RFC 9728 protected resource metadata, for `/_mcp`. */
  resourceMetadata(origin: string) {
    return {
      resource: this.resourceFor(origin),
      authorization_servers: [origin],
      scopes_supported: TOKEN_SCOPES,
      bearer_methods_supported: ['header'],
      resource_name: 'Wiki.js MCP server'
    }
  }

  // ==========================================
  // CLIENTS
  // ==========================================

  /**
   * Register a client (RFC 7591). Open to anybody — a client can do nothing until a person consents —
   * and the caller rate limits it per address.
   */
  async registerClient({
    name,
    redirectUris
  }: {
    name: string
    redirectUris: string[]
  }): Promise<OAuthClient> {
    const uris = [...new Set(redirectUris)]
    if (uris.length < 1 || uris.length > MAX_REDIRECT_URIS) {
      throw new OAuthError(
        'invalid_redirect_uri',
        `Register between 1 and ${MAX_REDIRECT_URIS} redirect URIs.`
      )
    }
    const bad = uris.find((uri) => !isAllowedRedirectUri(uri))
    if (bad) {
      throw new OAuthError(
        'invalid_redirect_uri',
        `${bad} is not an allowed redirect URI: https, http on a loopback address, or a native app's own scheme.`
      )
    }
    const rows = await WIKI.db
      .insert(clientsTable)
      .values({ name: name.trim().slice(0, 255) || 'MCP client', redirectUris: uris })
      .returning()
    return rows[0] as OAuthClient
  }

  async getClient(id: string): Promise<OAuthClient | null> {
    if (!uuidValidate(id)) {
      return null
    }
    const rows = await WIKI.db.select().from(clientsTable).where(eq(clientsTable.id, id)).limit(1)
    return (rows[0] as OAuthClient) ?? null
  }

  /**
   * The clients, with how many grants each holds, for the admin area's list: those holding a grant
   * first, then newest first, at most `limit`. Registration is open, so the list is capped — and
   * ordered so that a burst of registrations nobody uses, which `purge` clears within a day, cannot
   * push the clients actually in use off the end of it.
   */
  async listClients(limit = 50): Promise<Array<OAuthClient & { grants: number }>> {
    const rows = await WIKI.db
      .select({
        id: clientsTable.id,
        name: clientsTable.name,
        redirectUris: clientsTable.redirectUris,
        createdAt: clientsTable.createdAt,
        grants: count(tokensTable.id)
      })
      .from(clientsTable)
      .leftJoin(tokensTable, eq(tokensTable.clientId, clientsTable.id))
      .groupBy(clientsTable.id)
      .orderBy(sql`count(${tokensTable.id}) > 0 DESC`, sql`${clientsTable.createdAt} DESC`)
      .limit(limit)
    return rows.map((row: any) => ({ ...row, grants: Number(row.grants) }))
  }

  /** Delete a client, and with it every grant made to it and every code waiting. */
  async deleteClient(id: string): Promise<boolean> {
    const rows = await WIKI.db
      .delete(clientsTable)
      .where(eq(clientsTable.id, id))
      .returning({ id: clientsTable.id })
    return rows.length > 0
  }

  // ==========================================
  // AUTHORIZATION
  // ==========================================

  /**
   * Check an authorization request, as `/_oauth/authorize` receives it and as the consent screen
   * hands it back. Asked twice on purpose: what the screen shows and what a code is made from are
   * then the same request, checked the same way.
   */
  async checkAuthorization(
    params: Record<string, any>,
    origin: string
  ): Promise<AuthorizationRequest> {
    const client = await this.getClient(String(params.client_id ?? ''))
    if (!client) {
      throw new OAuthError('invalid_client', 'This client is not registered here.')
    }
    const requested = typeof params.redirect_uri === 'string' ? params.redirect_uri : ''
    const redirectUri =
      requested || (client.redirectUris.length === 1 ? client.redirectUris[0]! : '')
    if (!client.redirectUris.includes(redirectUri)) {
      throw new OAuthError('invalid_request', 'The redirect URI is not one this client registered.')
    }
    const state = typeof params.state === 'string' ? params.state : null
    // -> From here the client is real and the address is its own, so it may be told what is wrong
    const fail = (error: string, message: string) =>
      new OAuthError(error, message, { redirectable: true })
    if (params.response_type !== 'code') {
      throw fail('unsupported_response_type', 'Only the authorization code flow is supported.')
    }
    const codeChallenge = typeof params.code_challenge === 'string' ? params.code_challenge : ''
    if (
      !/^[A-Za-z0-9\-._~]{43,128}$/.test(codeChallenge) ||
      params.code_challenge_method !== 'S256'
    ) {
      throw fail('invalid_request', 'PKCE is required, with code_challenge_method S256.')
    }
    if (params.resource !== undefined) {
      const resource = String(params.resource).replace(/\/+$/, '')
      if (resource !== this.resourceFor(origin)) {
        throw fail(
          'invalid_target',
          `This server grants access to ${this.resourceFor(origin)} only.`
        )
      }
    }
    const asked = normalizeScopes(
      String(params.scope ?? '')
        .split(/\s+/)
        .filter(Boolean)
    )
    return {
      client,
      redirectUri,
      codeChallenge,
      state,
      scopes: asked.length > 0 ? asked : DEFAULT_GRANT_SCOPES
    }
  }

  /** Where the browser goes back to, with the answer on it. */
  redirectWith(
    redirectUri: string,
    params: Record<string, string | null | undefined>,
    origin: string
  ): string {
    const url = new URL(redirectUri)
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        url.searchParams.set(key, value)
      }
    }
    // -> RFC 9207: which server is answering, so a client talking to several cannot be mixed up
    url.searchParams.set('iss', origin)
    return url.toString()
  }

  /**
   * Record a person's consent as a code for the client to exchange.
   *
   * At least `mcp:read` is granted, whatever was ticked: the grant is for `/_mcp` and nothing else,
   * so one without an `mcp` scope could reach nothing at all.
   *
   * @returns The code, which exists only in the redirect it is put on
   */
  async createCode({
    request,
    userId,
    siteId,
    scopes,
    grantExpiration
  }: {
    request: AuthorizationRequest
    userId: string
    siteId: string
    scopes: string[]
    grantExpiration: KeyExpiration
  }): Promise<string> {
    const granted = normalizeScopes(scopes)
    if (!granted.some((scope) => scope.startsWith('mcp:'))) {
      granted.push('mcp:read')
    }
    const code = randomSecret()
    await WIKI.db.insert(codesTable).values({
      codeHash: sha256(code),
      clientId: request.client.id,
      userId,
      siteId,
      redirectUri: request.redirectUri,
      codeChallenge: request.codeChallenge,
      scopes: normalizeScopes(granted),
      grantExpiration,
      expiresAt: new Date(
        Temporal.Now.instant().add({ seconds: CODE_TTL_SECONDS }).epochMilliseconds
      )
    })
    return code
  }

  // ==========================================
  // TOKENS
  // ==========================================

  /**
   * Exchange a code for the grant it stands for (RFC 6749 §4.1.3, with PKCE).
   *
   * The code is deleted as it is read, so it is used once even when two exchanges race: the one that
   * does not get the row has nothing to exchange. A failed check consumes it as well, which is what
   * the specification asks of a code somebody may be guessing at.
   */
  async exchangeCode({
    code,
    clientId,
    redirectUri,
    codeVerifier
  }: {
    code: string
    clientId: string
    redirectUri: string | undefined
    codeVerifier: string
  }): Promise<TokenResponse> {
    const rows = await WIKI.db
      .delete(codesTable)
      .where(eq(codesTable.codeHash, sha256(code)))
      .returning()
    const row = rows[0]
    const invalid = () =>
      new OAuthError('invalid_grant', 'The code is not valid, has expired or has been used.')
    if (!row || row.clientId !== clientId) {
      throw invalid()
    }
    if (Temporal.Instant.compare(row.expiresAt.toTemporalInstant(), Temporal.Now.instant()) <= 0) {
      throw invalid()
    }
    if (redirectUri !== undefined && redirectUri !== row.redirectUri) {
      throw invalid()
    }
    if (!pkceMatches(codeVerifier, row.codeChallenge)) {
      throw new OAuthError('invalid_grant', 'The code verifier does not match the code challenge.')
    }
    const client = await this.getClient(row.clientId)
    if (!client) {
      throw invalid()
    }
    const held = await WIKI.db.$count(tokensTable, eq(tokensTable.userId, row.userId))
    if (held >= MAX_TOKENS_PER_USER) {
      throw new OAuthError(
        'invalid_grant',
        `The account holds the most personal access tokens it may (${MAX_TOKENS_PER_USER}). Delete one first.`
      )
    }

    const id = crypto.randomUUID()
    const secret = randomSecret()
    const expiresAt = Temporal.Now.instant()
      .toZonedDateTimeISO('UTC')
      .add(KEY_EXPIRATIONS[row.grantExpiration as KeyExpiration])
      .toInstant()
    await WIKI.db.insert(tokensTable).values({
      id,
      userId: row.userId,
      name: client.name,
      // -> A grant has no token of its own to show the end of; the client's name stands for it
      keyShort: '',
      scopes: row.scopes,
      expiration: new Date(expiresAt.epochMilliseconds),
      clientId: client.id,
      refreshHash: sha256(secret)
    })
    return this.tokenResponse(id, row.userId, secret, row.scopes as TokenScope[])
  }

  /**
   * Swap a refresh token for a new pair (RFC 6749 §6), rotating the refresh token.
   *
   * A refresh token is `<grant id>.<secret>`, and only the secret's hash is kept. One whose grant
   * exists but whose secret is not the current one has been used already — by its holder, or by
   * somebody who copied it — and OAuth 2.1 §4.3.1 says to revoke the grant when that happens: one of
   * the two presenters is not who they say. The rotation itself is a compare-and-swap on the hash,
   * so two refreshes racing cannot both succeed.
   */
  async refresh({
    refreshToken,
    clientId
  }: {
    refreshToken: string
    clientId: string
  }): Promise<TokenResponse> {
    const [id, secret] = refreshToken.split('.')
    const invalid = () =>
      new OAuthError('invalid_grant', 'The refresh token is not valid or has expired.')
    if (!id || !secret || !uuidValidate(id)) {
      throw invalid()
    }
    const rows = await WIKI.db
      .select({
        userId: tokensTable.userId,
        scopes: tokensTable.scopes,
        expiration: tokensTable.expiration,
        clientId: tokensTable.clientId,
        refreshHash: tokensTable.refreshHash,
        isActive: usersTable.isActive
      })
      .from(tokensTable)
      .innerJoin(usersTable, eq(usersTable.id, tokensTable.userId))
      .where(eq(tokensTable.id, id))
      .limit(1)
    const row = rows[0]
    if (!row || !row.clientId || row.clientId !== clientId || !row.refreshHash) {
      throw invalid()
    }
    if (!timingSafeCompare(sha256(secret), row.refreshHash)) {
      await WIKI.db.delete(tokensTable).where(eq(tokensTable.id, id))
      WIKI.logger.warn(`An OAuth refresh token was used twice; grant ${id} has been revoked.`)
      throw new OAuthError(
        'invalid_grant',
        'This refresh token has been used before, so the grant has been revoked. Connect again.'
      )
    }
    if (Temporal.Instant.compare(row.expiration.toTemporalInstant(), Temporal.Now.instant()) <= 0) {
      throw new OAuthError('invalid_grant', 'The grant has expired. Connect again.')
    }
    if (!row.isActive) {
      throw invalid()
    }
    const next = randomSecret()
    const swapped = await WIKI.db
      .update(tokensTable)
      .set({ refreshHash: sha256(next), updatedAt: new Date() })
      .where(and(eq(tokensTable.id, id), eq(tokensTable.refreshHash, row.refreshHash)))
      .returning({ id: tokensTable.id })
    if (swapped.length < 1) {
      throw invalid()
    }
    return this.tokenResponse(id, row.userId, next, row.scopes as TokenScope[])
  }

  /** An access token for a grant: the personal-token audience, naming the grant's row, for an hour. */
  private tokenResponse(
    grantId: string,
    userId: string,
    refreshSecret: string,
    scopes: TokenScope[]
  ): TokenResponse {
    const now = Temporal.Now.instant()
    const accessToken = WIKI.models.apiKeys.sign({
      id: grantId,
      sub: userId,
      aud: PERSONAL_TOKEN_AUDIENCE,
      iat: epochSeconds(now),
      exp: epochSeconds(now.add({ seconds: ACCESS_TOKEN_TTL_SECONDS }))
    })
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
      refresh_token: `${grantId}.${refreshSecret}`,
      scope: normalizeScopes(scopes).join(' ')
    }
  }

  /**
   * Drop what the flow leaves behind: codes nobody exchanged, and clients no grant ever named once
   * they are a day old. Hourly, off `SYSTEM_SCHEDULE`.
   *
   * @returns How many clients were purged
   */
  async purge(): Promise<number> {
    await WIKI.db.delete(codesTable).where(lt(codesTable.expiresAt, new Date()))
    const cutoff = new Date(
      Temporal.Now.instant().subtract({ hours: UNUSED_CLIENT_TTL_HOURS }).epochMilliseconds
    )
    const purged = await WIKI.db
      .delete(clientsTable)
      .where(
        and(
          lt(clientsTable.createdAt, cutoff),
          notExists(
            WIKI.db
              .select({ one: sql`1` })
              .from(tokensTable)
              .where(eq(tokensTable.clientId, clientsTable.id))
          ),
          notExists(
            WIKI.db
              .select({ one: sql`1` })
              .from(codesTable)
              .where(eq(codesTable.clientId, clientsTable.id))
          )
        )
      )
      .returning({ id: clientsTable.id })
    return purged.length
  }
}

export const oauth = new OAuth()
