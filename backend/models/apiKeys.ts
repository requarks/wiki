import crypto from 'node:crypto'
import { apiKeys as apiKeysTable, groups as groupsTable } from '../db/schema.ts'
import { desc, eq, inArray, sql } from 'drizzle-orm'
import { flatten, uniq } from 'es-toolkit/array'
import { epochSeconds, signJwt, verifyJwt } from '../helpers/jwt.ts'

/** The lifetimes the admin area offers, as durations the API accepts. */
export const KEY_EXPIRATIONS = {
  '30d': { days: 30 },
  '90d': { days: 90 },
  '180d': { days: 180 },
  '1y': { years: 1 },
  '3y': { years: 3 }
} as const

export type KeyExpiration = keyof typeof KEY_EXPIRATIONS

/** An API key as exposed by the API. Never includes the token itself, which is not stored. */
export interface ApiKey {
  id: string
  name: string
  keyShort: string
  groups: string[]
  expiration: Date
  isRevoked: boolean
  createdAt: Date
  updatedAt: Date
}

/** What a verified key grants, resolved from its groups at request time. */
export interface ApiKeyIdentity {
  id: string
  permissions: string[]
}

/** Raised by `verify()` when a token is not usable, with a reason safe to return to the caller. */
export class ApiKeyError extends Error {}

const keySelection = {
  id: apiKeysTable.id,
  name: apiKeysTable.name,
  keyShort: apiKeysTable.keyShort,
  groups: apiKeysTable.groups,
  expiration: apiKeysTable.expiration,
  isRevoked: apiKeysTable.isRevoked,
  createdAt: apiKeysTable.createdAt,
  updatedAt: apiKeysTable.updatedAt
}

/**
 * API Keys model
 *
 * A key is an RS256 JWT signed with the installation keypair, carrying the key row's ID and the
 * groups it draws permissions from. The token is shown once at creation and never stored: the
 * signature proves authenticity, and the row is consulted for revocation and expiry. Permissions are
 * resolved from the groups on every request, so changing a group takes effect immediately.
 */
class ApiKeys {
  /**
   * The signing key, built from the passphrase-protected PEM in `config.auth.certs`
   */
  private privateKey(): crypto.KeyObject {
    return crypto.createPrivateKey({
      key: WIKI.config.auth.certs.private,
      passphrase: WIKI.config.auth.secret
    })
  }

  /**
   * Every key, newest first. Revoked and expired keys are kept: the admin list shows their state.
   */
  async getKeys(): Promise<ApiKey[]> {
    const results = await WIKI.db
      .select(keySelection)
      .from(apiKeysTable)
      .orderBy(desc(apiKeysTable.createdAt))
    return results as ApiKey[]
  }

  /**
   * Mint a new key.
   *
   * @returns The key row plus the token, which is the only time it exists outside the client
   */
  async createKey({
    name,
    expiration,
    groups
  }: {
    name: string
    expiration: KeyExpiration
    groups: string[]
  }): Promise<{ id: string; key: string }> {
    const id = crypto.randomUUID()
    const expiresAt = Temporal.Now.zonedDateTimeISO('UTC')
      .add(KEY_EXPIRATIONS[expiration])
      .toInstant()

    const key = signJwt(
      {
        // -> `api` marks the token as a key rather than a user token, so the two can never be
        //    confused should user tokens ever be signed with the same keypair
        api: 1,
        id,
        grp: groups,
        aud: WIKI.config.auth.audience,
        iat: epochSeconds(),
        exp: epochSeconds(expiresAt)
      },
      this.privateKey()
    )

    await WIKI.db.insert(apiKeysTable).values({
      id,
      name,
      keyShort: key.slice(-8),
      groups,
      expiration: new Date(expiresAt.epochMilliseconds),
      isRevoked: false
    })

    return { id, key }
  }

  /**
   * A single key, or null if there is no such key
   */
  async getKeyById(id: string): Promise<ApiKey | null> {
    const results = await WIKI.db
      .select(keySelection)
      .from(apiKeysTable)
      .where(eq(apiKeysTable.id, id))
      .limit(1)
    return (results[0] as ApiKey) ?? null
  }

  /**
   * Revoke a key, permanently. Tokens already handed out stop working on the next request.
   *
   * @returns Whether a key was revoked
   */
  async revokeKey(id: string): Promise<boolean> {
    const result = await WIKI.db
      .update(apiKeysTable)
      .set({ isRevoked: true, updatedAt: sql`now()` })
      .where(eq(apiKeysTable.id, id))
    return (result.rowCount ?? 0) > 0
  }

  /**
   * The union of the permissions held by the given groups.
   *
   * A group that no longer exists simply contributes nothing, so deleting a group narrows the keys
   * pointing at it instead of breaking them.
   */
  async resolvePermissions(groupIds: string[]): Promise<string[]> {
    if (groupIds.length < 1) {
      return []
    }
    const rows = await WIKI.db
      .select({ permissions: groupsTable.permissions })
      .from(groupsTable)
      .where(inArray(groupsTable.id, groupIds))
    return uniq(flatten(rows.map((r: any) => (r.permissions ?? []) as string[])))
  }

  /**
   * Verify a bearer token and resolve what it grants.
   *
   * @throws ApiKeyError with a reason suitable for a 401 response
   */
  async verify(token: string): Promise<ApiKeyIdentity> {
    if (WIKI.config.api.isEnabled !== true) {
      throw new ApiKeyError('The API is disabled.')
    }

    let claims
    try {
      claims = verifyJwt(token, WIKI.config.auth.certs.public, {
        audience: WIKI.config.auth.audience
      })
    } catch (err: any) {
      throw new ApiKeyError(err.message)
    }

    if (claims.api !== 1 || typeof claims.id !== 'string') {
      throw new ApiKeyError('Token is not an API key.')
    }

    const key = await this.getKeyById(claims.id)
    if (!key) {
      throw new ApiKeyError('API key does not exist.')
    }
    if (key.isRevoked) {
      throw new ApiKeyError('API key has been revoked.')
    }
    // -> The token carries its own expiry, but the row is what the admin area shows; a mismatch
    //    should fail closed rather than trust the token
    if (Temporal.Instant.compare(key.expiration.toTemporalInstant(), Temporal.Now.instant()) <= 0) {
      throw new ApiKeyError('API key has expired.')
    }

    return {
      id: key.id,
      permissions: await this.resolvePermissions(
        Array.isArray(claims.grp) ? (claims.grp as string[]) : []
      )
    }
  }
}

export const apiKeys = new ApiKeys()
