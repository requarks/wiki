import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from '@simplewebauthn/server'
import { isoBase64URL } from '@simplewebauthn/server/helpers'
import { eq, sql } from 'drizzle-orm'
import { validate as uuidValidate } from 'uuid'
import { users as usersTable } from '../db/schema.ts'
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON
} from '@simplewebauthn/server'
import type { AfterLoginResult } from './users.ts'

/**
 * One registered authenticator, as stored in the user's `passkeys` blob. Every binary value is held
 * base64url-encoded, since this lives in a JSONB column.
 */
interface StoredPasskey {
  /** The credential ID, which is also what the browser sends back to identify it. */
  id: string
  name: string
  /** COSE public key, base64url-encoded. */
  publicKey: string
  /** Signature counter last reported by the authenticator, for replay detection. */
  counter: number
  transports?: AuthenticatorTransportFuture[]
  createdAt: string
  siteId: string
  /** The hostname the credential is bound to. A passkey only works on the site it was created on. */
  rpId: string
}

/**
 * A ceremony waiting to be answered. Held on the session between the two requests a ceremony takes —
 * see the note on `Session.passkeyLogin` in `types/fastify.d.ts` for why it cannot live anywhere else.
 */
export interface PasskeyChallenge {
  challenge: string
  rpId: string
  origin: string
  siteId: string
}

/** What a user's `passkeys` column holds: the credentials themselves, and nothing transient. */
interface PasskeyStore {
  authenticators?: StoredPasskey[]
}

/** A passkey as the profile page lists it — never the key material. */
export interface PasskeyInfo {
  id: string
  name: string
  siteHostname: string
  createdAt: string
}

/**
 * Hostnames a browser treats as a secure context without TLS, so that `http://localhost:3001` — the
 * dev server — is a usable origin. Anything else has to be https, which is a WebAuthn requirement
 * rather than a choice made here.
 */
const insecureOriginExceptions = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

/**
 * The origin a passkey ceremony must be performed on.
 *
 * Taken from the request's own `Origin` header rather than assembled from the hostname, because the
 * port is part of an origin and this instance does not know which one the browser reached it on. That
 * is safe because the header is only trusted as far as it agrees with the host the request was
 * addressed to: a page on another origin posting here would disagree, and is rejected. What the
 * header cannot establish is that the connection was secure, so that is checked separately.
 *
 * @param origin The `Origin` header, if the client sent one
 * @param hostname The host the request was addressed to, i.e. the RP ID
 * @throws `ERR_PK_INSECURE_ORIGIN` for an origin that does not match, or that is not a secure context
 */
function resolveOrigin(origin: string | undefined, hostname: string): string {
  // -> A client that sends no Origin at all is not a browser doing a WebAuthn ceremony, but it may
  //    still be a legitimate API client driving one, so the canonical https origin is assumed
  if (!origin) {
    return `https://${hostname}`
  }

  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    throw new Error('ERR_PK_INSECURE_ORIGIN')
  }
  if (parsed.hostname !== hostname) {
    throw new Error('ERR_PK_INSECURE_ORIGIN')
  }
  if (parsed.protocol !== 'https:' && !insecureOriginExceptions.has(parsed.hostname)) {
    throw new Error('ERR_PK_INSECURE_ORIGIN')
  }
  return parsed.origin
}

/**
 * Passkeys (WebAuthn) model
 *
 * Credentials are stored in the user's `passkeys` JSONB column rather than a table of their own: they
 * are only ever read for one user at a time, and they die with the account.
 */
class Passkeys {
  /**
   * The passkeys registered by a user, as the profile page lists them.
   */
  async list(userId: string): Promise<PasskeyInfo[]> {
    const store = await this.getStore(userId)
    return (store.authenticators ?? []).map((pk) => ({
      id: pk.id,
      name: pk.name,
      // -> The hostname it was registered against, not the site's current one: that is what the
      //    credential is actually bound to, and renaming a site does not move it
      siteHostname: pk.rpId,
      createdAt: pk.createdAt
    }))
  }

  /**
   * Options for registering a new passkey.
   *
   * @param userId The user registering it, who must be logged in
   * @param hostname The host being browsed, which becomes the RP ID the credential is bound to
   * @param origin The request's `Origin` header
   * @returns The options to hand the browser, and the challenge to remember for
   *          `finalizeRegistration()`
   * @throws `ERR_INVALID_USER`, `ERR_PK_HOSTNAME_MISSING` or `ERR_PK_INSECURE_ORIGIN`
   */
  async startRegistration({
    userId,
    hostname,
    origin
  }: {
    userId: string
    hostname: string
    origin?: string
  }): Promise<{
    registrationOptions: PublicKeyCredentialCreationOptionsJSON
    pending: PasskeyChallenge
  }> {
    const user = await WIKI.models.users.getById(userId)
    if (!user) {
      throw new Error('ERR_INVALID_USER')
    }
    if (!hostname || hostname === '*') {
      throw new Error('ERR_PK_HOSTNAME_MISSING')
    }
    const expectedOrigin = resolveOrigin(origin, hostname)

    const site = await WIKI.models.sites.getSiteByHostname({ hostname })
    const store = (user.passkeys ?? {}) as PasskeyStore

    const options = await generateRegistrationOptions({
      rpName: site?.config?.title || 'Wiki',
      rpID: hostname,
      // -> The user handle comes back on login as the only clue to who is signing in, so it is the
      //    user ID itself rather than a random value that would need a second lookup table
      userID: new TextEncoder().encode(user.id),
      userName: user.email,
      userDisplayName: user.name,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred'
      },
      // -> Every credential the user already has, so the authenticator can refuse to enroll twice and
      //    the browser can say so before anything is stored
      excludeCredentials: (store.authenticators ?? []).map((pk) => ({
        id: pk.id,
        transports: pk.transports
      }))
    })

    return {
      registrationOptions: options,
      pending: {
        challenge: options.challenge,
        rpId: hostname,
        origin: expectedOrigin,
        siteId: site?.id ?? ''
      }
    }
  }

  /**
   * Verify what the authenticator produced and store the credential under the given name.
   *
   * @param pending The challenge `startRegistration()` handed out, off the session
   * @throws `ERR_INVALID_USER`, `ERR_PASSKEY_NOT_SETUP`, `ERR_PK_NAME_MISSING_OR_INVALID`,
   *         `ERR_PK_ALREADY_REGISTERED` or `ERR_PK_VERIFICATION_FAILED`
   */
  async finalizeRegistration({
    userId,
    name,
    registrationResponse,
    pending
  }: {
    userId: string
    name: string
    registrationResponse: RegistrationResponseJSON
    pending?: PasskeyChallenge
  }): Promise<PasskeyInfo> {
    const user = await WIKI.models.users.getById(userId)
    if (!user) {
      throw new Error('ERR_INVALID_USER')
    }
    if (!pending) {
      throw new Error('ERR_PASSKEY_NOT_SETUP')
    }
    const store = (user.passkeys ?? {}) as PasskeyStore
    const trimmedName = (name ?? '').trim()
    if (trimmedName.length < 1 || trimmedName.length > 255) {
      throw new Error('ERR_PK_NAME_MISSING_OR_INVALID')
    }

    let verification
    try {
      verification = await verifyRegistrationResponse({
        response: registrationResponse,
        expectedChallenge: pending.challenge,
        expectedOrigin: pending.origin,
        expectedRPID: pending.rpId,
        // -> Matches the `preferred` asked for above: an authenticator that has no way to verify the
        //    user is still worth registering, and requiring it here would reject exactly those
        requireUserVerification: false
      })
    } catch (err: any) {
      WIKI.models.flags.authDebug(
        `Passkey registration for user ${user.id} failed verification: ${err.message}`
      )
      throw new Error('ERR_PK_VERIFICATION_FAILED')
    }
    if (!verification.verified) {
      throw new Error('ERR_PK_VERIFICATION_FAILED')
    }

    const { credential } = verification.registrationInfo
    const authenticators = store.authenticators ?? []
    if (authenticators.some((pk) => pk.id === credential.id)) {
      throw new Error('ERR_PK_ALREADY_REGISTERED')
    }

    const passkey: StoredPasskey = {
      id: credential.id,
      name: trimmedName,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      counter: credential.counter,
      transports: registrationResponse.response.transports,
      createdAt: Temporal.Now.instant().toString({ smallestUnit: 'millisecond' }),
      siteId: pending.siteId,
      rpId: pending.rpId
    }

    await this.saveStore(user.id, { authenticators: [...authenticators, passkey] })

    WIKI.models.flags.authDebug(
      `User ${user.id} <${user.email}> registered passkey "${trimmedName}" on ${pending.rpId}`
    )

    return {
      id: passkey.id,
      name: passkey.name,
      siteHostname: passkey.rpId,
      createdAt: passkey.createdAt
    }
  }

  /**
   * Forget a passkey. The credential itself lives on the user's device and has to be removed there
   * too, which is what the client says when this succeeds.
   *
   * @returns False if the user has no such passkey
   */
  async remove(userId: string, passkeyId: string): Promise<boolean> {
    const store = await this.getStore(userId)
    const authenticators = store.authenticators ?? []
    const remaining = authenticators.filter((pk) => pk.id !== passkeyId)
    if (remaining.length === authenticators.length) {
      return false
    }
    await this.saveStore(userId, { ...store, authenticators: remaining })
    WIKI.models.flags.authDebug(`User ${userId} removed a passkey`)
    return true
  }

  /**
   * Options for logging in with a passkey.
   *
   * Nobody is named here, and no `allowCredentials` list is sent: every passkey is registered as a
   * discoverable credential, so the authenticator offers whichever ones it holds for this host and the
   * assertion says who signed. That is what makes a passkey login one gesture — there is nothing to ask
   * the user first, and no lookup that could reveal whether an address has an account.
   *
   * @returns The options to hand the browser, and the challenge to remember for `verifyLogin()`
   * @throws `ERR_PK_HOSTNAME_MISSING` or `ERR_PK_INSECURE_ORIGIN`
   */
  async startLogin({ hostname, origin }: { hostname: string; origin?: string }): Promise<{
    authOptions: PublicKeyCredentialRequestOptionsJSON
    pending: PasskeyChallenge
  }> {
    if (!hostname || hostname === '*') {
      throw new Error('ERR_PK_HOSTNAME_MISSING')
    }
    const expectedOrigin = resolveOrigin(origin, hostname)

    const options = await generateAuthenticationOptions({
      rpID: hostname,
      userVerification: 'preferred'
    })

    return {
      authOptions: options,
      pending: {
        challenge: options.challenge,
        rpId: hostname,
        origin: expectedOrigin,
        siteId: (await WIKI.models.sites.getSiteByHostname({ hostname }))?.id ?? ''
      }
    }
  }

  /**
   * Verify a passkey login and, if it holds up, log the user in.
   *
   * A passkey establishes both who the user is and that they were present, so this does not go on to
   * ask for a password or a 2FA code. The account checks the password strategy performs still apply —
   * a deactivated account cannot be signed into with a key either.
   *
   * Who signed comes out of the assertion's user handle, which is the only way this can work: the
   * challenge was handed out before anyone was named.
   *
   * @param pending The challenge `startLogin()` handed out, off the session
   * @returns The same shape a password login returns, so the client handles both the same way
   * @throws `ERR_LOGIN_FAILED`, `ERR_INACTIVE_USER` or `ERR_USER_NOT_VERIFIED`
   */
  async verifyLogin(
    {
      authResponse,
      pending,
      ip
    }: {
      authResponse: AuthenticationResponseJSON
      pending?: PasskeyChallenge
      ip?: string
    },
    req: any
  ): Promise<AfterLoginResult> {
    if (!pending) {
      WIKI.models.flags.authDebug(
        'Passkey login rejected: no challenge outstanding on this session'
      )
      throw new Error('ERR_LOGIN_FAILED')
    }

    const userHandle = authResponse.response?.userHandle
    if (!userHandle) {
      WIKI.models.flags.authDebug('Passkey login rejected: the response carried no user handle')
      throw new Error('ERR_LOGIN_FAILED')
    }

    // -> The handle is the user ID this server encoded at registration, so anything else is not a
    //    credential of ours. Checked for shape before it is looked up: postgres rejects a malformed
    //    uuid with an error of its own, which would turn a rejected login into a logged fault.
    let userId: string
    try {
      userId = isoBase64URL.toUTF8String(userHandle)
    } catch {
      throw new Error('ERR_LOGIN_FAILED')
    }
    if (!uuidValidate(userId)) {
      WIKI.models.flags.authDebug('Passkey login rejected: the user handle is not one of ours')
      throw new Error('ERR_LOGIN_FAILED')
    }

    const user = await WIKI.models.users.getById(userId)
    if (!user) {
      WIKI.models.flags.authDebug(`Passkey login rejected: no user ${userId}`)
      throw new Error('ERR_LOGIN_FAILED')
    }
    const store = (user.passkeys ?? {}) as PasskeyStore
    const passkey = (store.authenticators ?? []).find((pk) => pk.id === authResponse.id)
    if (!passkey) {
      WIKI.models.flags.authDebug(
        `Passkey login rejected: credential ${authResponse.id} is not registered for user ${userId}`
      )
      throw new Error('ERR_LOGIN_FAILED')
    }

    let verification
    try {
      verification = await verifyAuthenticationResponse({
        response: authResponse,
        expectedChallenge: pending.challenge,
        expectedOrigin: pending.origin,
        expectedRPID: pending.rpId,
        // -> As at registration: the ceremony asked for `preferred`, so requiring it here would turn
        //    an authenticator that cannot verify into a login that never succeeds
        requireUserVerification: false,
        credential: {
          id: passkey.id,
          publicKey: isoBase64URL.toBuffer(passkey.publicKey),
          counter: passkey.counter,
          transports: passkey.transports
        }
      })
    } catch (err: any) {
      WIKI.models.flags.authDebug(
        `Passkey login for user ${userId} failed to verify: ${err.message}`
      )
      throw new Error('ERR_LOGIN_FAILED')
    }
    if (!verification.verified) {
      throw new Error('ERR_LOGIN_FAILED')
    }

    // -> The counter has to be stored for the replay check to mean anything next time
    await this.saveStore(user.id, {
      authenticators: (store.authenticators ?? []).map((pk) =>
        pk.id === passkey.id ? { ...pk, counter: verification.authenticationInfo.newCounter } : pk
      )
    })

    // -> Checks the password strategy would have made, which a passkey login would otherwise skip
    if (!user.isActive) {
      throw new Error('ERR_INACTIVE_USER')
    }
    if (!user.isVerified) {
      throw new Error('ERR_USER_NOT_VERIFIED')
    }

    WIKI.models.flags.authDebug(
      `User ${user.id} <${user.email}> authenticated with passkey "${passkey.name}"`
    )

    // -> Attributed to the local strategy, which is where an account's own credentials belong. Neither
    //    a password change nor a 2FA code is asked for on top of a passkey.
    return WIKI.models.users.afterLoginChecks(
      user,
      WIKI.data.systemIds.localAuthId,
      { ip, siteId: pending.siteId },
      { skipTFA: true, skipChangePwd: true },
      req
    )
  }

  /**
   * The stored blob for a user, or an empty one for a user who has never registered a passkey.
   */
  async getStore(userId: string): Promise<PasskeyStore> {
    const user = await WIKI.models.users.getById(userId)
    return (user?.passkeys ?? {}) as PasskeyStore
  }

  /**
   * Replace a user's stored passkey blob.
   */
  async saveStore(userId: string, store: PasskeyStore): Promise<void> {
    await WIKI.db
      .update(usersTable)
      .set({ passkeys: { authenticators: store.authenticators ?? [] }, updatedAt: sql`now()` })
      .where(eq(usersTable.id, userId))
  }
}

export const passkeys = new Passkeys()
