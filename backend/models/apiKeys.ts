import crypto from 'node:crypto'
import { apiKeys as apiKeysTable, groups as groupsTable } from '../db/schema.ts'
import { and, desc, eq, gt, inArray, sql } from 'drizzle-orm'
import { flatten, uniq } from 'es-toolkit/array'
import { epochSeconds, signJwt, verifyJwt } from '../helpers/jwt.ts'

/**
 * The `aud` claim every key carries, and the one value `verify()` accepts.
 *
 * Fixed rather than configurable: the wiki is both the issuer and the only audience of these tokens,
 * so there is nothing for an operator to point it at. It was a setting until the admin area's JWT
 * section went — a section whose other two fields nothing read — and all changing it ever did was
 * invalidate every key already issued.
 */
const TOKEN_AUDIENCE = 'urn:wiki.js'

/** An API key signing keypair, with the passphrase its private half is encrypted under. */
export interface SigningCertificates {
  /** Protects the private key at rest. Belongs to the keypair, and is rotated with it. */
  passphrase: string
  /**
   * When this keypair came into being, as an RFC 3339 instant.
   *
   * Kept because it is the only thing that can explain a key which is neither revoked nor expired
   * and still does not work: a key issued before this moment was signed by a keypair that no longer
   * exists. See {@link ApiKeys.getKeys}.
   */
  generatedAt: string
  public: string
  private: string
}

/**
 * A fresh signing keypair.
 *
 * Called twice: once at install, to seed `auth.certs` (`models/settings.ts`), and again whenever an
 * administrator invalidates the certificates. Both go through here so that a rotated keypair is
 * generated exactly like the original one.
 *
 * The passphrase is generated with the keypair rather than taken from anywhere else. It used to be
 * `auth.secret` — the same value @fastify/session signs cookies with — which tied two unrelated
 * secrets together: rotating the session secret would have left the private key undecryptable, and
 * replacing the keypair meant logging everybody out.
 */
export function generateSigningCertificates(): SigningCertificates {
  const passphrase = crypto.randomBytes(32).toString('hex')
  const pair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'pkcs1',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs1',
      format: 'pem',
      cipher: 'aes-256-cbc',
      passphrase
    }
  })
  return {
    passphrase,
    generatedAt: Temporal.Now.instant().toString({ smallestUnit: 'millisecond' }),
    public: pair.publicKey,
    private: pair.privateKey
  }
}

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

/**
 * A key as the admin area lists it: the row, plus whether the certificates have moved on without it.
 *
 * `isInvalidated` is not stored anywhere. It is the row's age compared against the keypair's, which
 * is the whole of what makes a key stop working when the certificates are regenerated.
 */
export interface ApiKeyListEntry extends ApiKey {
  isInvalidated: boolean
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
      passphrase: WIKI.config.auth.certs.passphrase
    })
  }

  /**
   * Replace the signing keypair and its passphrase, invalidating every key ever issued.
   *
   * A key is only a signature over its claims, so this is what takes back keys that have escaped:
   * the rows stay, and every token signed by the old key stops verifying on the next request. The
   * rows are not marked revoked — revocation is a decision an administrator made about one key, and
   * saying that about all of them would lose the distinction. Minting a key from the same row is not
   * possible either, so the count returned is what an administrator has to reissue.
   *
   * Session cookies are untouched: they are signed with `auth.secret`, which this does not go near.
   *
   * @returns How many keys were still usable and no longer are, or null if the settings failed to save
   */
  async regenerateCertificates(): Promise<number | null> {
    const previousAuth = WIKI.config.auth
    const usable = await WIKI.db.$count(
      apiKeysTable,
      and(eq(apiKeysTable.isRevoked, false), gt(apiKeysTable.expiration, sql`now()`))
    )

    WIKI.config.auth = { ...previousAuth, certs: generateSigningCertificates() }
    // -> Propagates as `reloadConfig`, which is how the other instances pick up the new public key
    //    rather than going on trusting tokens this one has just disowned
    if (!(await WIKI.configSvc.saveToDb(['auth']))) {
      WIKI.config.auth = previousAuth
      return null
    }

    WIKI.logger.info(`Regenerated the API key certificates, invalidating ${usable} key(s) [ OK ]`)
    return usable
  }

  /**
   * Every key, newest first. Revoked and expired keys are kept: the admin list shows their state.
   *
   * Each one is marked against the age of the signing keypair. A key issued before the certificates
   * were last regenerated was signed by a keypair that is gone, so it fails verification on its
   * signature and there is nothing about the row itself to explain why — which is exactly the state
   * an administrator needs pointed out, and the one thing distinguishing it from a key somebody
   * chose to revoke.
   */
  async getKeys(): Promise<ApiKeyListEntry[]> {
    const results = await WIKI.db
      .select(keySelection)
      .from(apiKeysTable)
      .orderBy(desc(apiKeysTable.createdAt))
    const generatedAt = Temporal.Instant.from(WIKI.config.auth.certs.generatedAt)
    return (results as ApiKey[]).map((key) => ({
      ...key,
      isInvalidated: Temporal.Instant.compare(key.createdAt.toTemporalInstant(), generatedAt) < 0
    }))
  }

  /** When the keypair keys are signed with came into being. */
  certificatesGeneratedAt(): string {
    return WIKI.config.auth.certs.generatedAt
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
        id,
        grp: groups,
        aud: TOKEN_AUDIENCE,
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
   * Delete every revoked key.
   *
   * Housekeeping, not a security measure: a revoked key already authenticates nothing, and this only
   * takes its row out of the admin list. What it costs is the record that the key ever existed, which
   * is why nothing does it automatically.
   *
   * Invalidated keys are left alone. One of those is still a key somebody issued and has not decided
   * anything about — it stopped working because the certificates moved, and the row is what tells its
   * owner they have to reissue it. A key that is both revoked and invalidated goes: revoking is the
   * decision, and this deletes what was decided about.
   *
   * @returns How many keys were deleted
   */
  async purgeRevoked(): Promise<number> {
    const result = await WIKI.db.delete(apiKeysTable).where(eq(apiKeysTable.isRevoked, true))
    const purged = result.rowCount ?? 0
    WIKI.logger.info(`Purged ${purged} revoked API key(s) [ OK ]`)
    return purged
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
        audience: TOKEN_AUDIENCE
      })
    } catch (err: any) {
      throw new ApiKeyError(err.message)
    }

    // -> A token this keypair signed but which names no key. There is nothing else it could be —
    //    logins are sessions, and this keypair signs nothing but API keys.
    if (typeof claims.id !== 'string') {
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
