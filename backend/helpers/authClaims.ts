import { isPlainObject } from 'es-toolkit/predicate'
import { strategyDebug } from './authDebug.ts'
import type { ProviderProfile, ProviderProfileMetaKey } from '../models/authentication.ts'

/**
 * Reading who signed in out of a provider's answer, for the modules that let an administrator say
 * which field carries what: OpenID Connect, whose answer is the ID token's claims merged with the
 * userinfo response, and generic OAuth2, whose answer is the userinfo response alone.
 *
 * Both are configured with the same settings — `idClaim`, `emailClaim`, `requireVerifiedEmail`,
 * `verifiedEmailClaim`, `displayNameClaim`, `pictureClaim`, `handleClaim`, the profile fields, and
 * the group mapping — so both read them here, and a provider is held to the same rules whichever of
 * the two signs it in.
 */

/** A module instance carrying the settings this reads. */
export interface ClaimStrategy {
  strategyId: string
  module?: string
  conf: Record<string, any>
}

/** Which setting names the claim for each profile field a provider may fill in. */
const META_CLAIM_SETTINGS: Record<ProviderProfileMetaKey, string> = {
  location: 'locationClaim',
  jobTitle: 'jobTitleClaim',
  pronouns: 'pronounsClaim'
}

/**
 * The value a claim name points at.
 *
 * A key of the answer by that exact name first, since claim names may themselves contain dots — a
 * namespaced claim is commonly a URL, `https://example.com/roles`. Only when there is none is the
 * name read as a dotted path into nested objects (`realm_access.roles`), with a numeric segment
 * indexing an array (`emails.0.address`), for providers that nest what they answer with.
 *
 * Own properties only, at every step: a claim named `constructor` or `__proto__` is something the
 * provider did not say, and must not be answered by whatever an object inherits.
 */
export function readClaim(info: Record<string, any>, name: string): unknown {
  if (Object.hasOwn(info, name)) {
    return info[name]
  }
  if (!name.includes('.')) {
    return undefined
  }
  let value: unknown = info
  for (const segment of name.split('.')) {
    if (Array.isArray(value) && /^\d+$/.test(segment)) {
      value = value[Number(segment)]
    } else if (isPlainObject(value) && Object.hasOwn(value, segment)) {
      value = value[segment]
    } else {
      return undefined
    }
  }
  return value
}

/**
 * Who signed in, read from the provider's answer.
 *
 * The identifier is what the account is linked by from here on, so it has to be one: a non-empty
 * string, or a whole number, which plenty of APIs number their accounts with and which is kept as its
 * decimal string. The email address is what an account here is matched or created by, so it is
 * required too.
 *
 * @param defaults The claim each required setting falls back to when it is empty, which is where the
 *                 two protocols differ — OpenID Connect names the account `sub`, most APIs `id`.
 * @throws `ERR_NO_PROVIDER_ACCOUNT`, `ERR_NO_EMAIL_FROM_PROVIDER`, `ERR_EMAIL_NOT_VERIFIED`
 */
export function profileFromClaims(
  strategy: ClaimStrategy,
  info: Record<string, any>,
  defaults: { idClaim: string }
): ProviderProfile {
  const conf = strategy.conf
  const idClaim = conf.idClaim || defaults.idClaim
  const rawId = readClaim(info, idClaim)
  const id = typeof rawId === 'string' ? rawId : Number.isSafeInteger(rawId) ? String(rawId) : ''
  if (!id) {
    strategyDebug(
      strategy,
      `the \`${idClaim}\` claim carries no identifier for this account (ID Claim)`
    )
    throw new Error('ERR_NO_PROVIDER_ACCOUNT')
  }
  const emailClaim = conf.emailClaim || 'email'
  const email = readClaim(info, emailClaim)
  if (!email || typeof email !== 'string') {
    strategyDebug(
      strategy,
      `the \`${emailClaim}\` claim carries no address, and an account here is matched by address (Email Claim)`
    )
    throw new Error('ERR_NO_EMAIL_FROM_PROVIDER')
  }
  checkEmailVerified(strategy, info, email)
  const groups = conf.mapGroups === true ? groupsFrom(strategy, info) : undefined
  strategyDebug(
    strategy,
    `${id} signs in as <${email}>${groups ? `, in ${groups.length} provider group(s)` : ', groups not mapped'}`
  )
  const name = readClaim(info, conf.displayNameClaim || 'name')
  return {
    id,
    email,
    name: typeof name === 'string' && name.trim().length > 0 ? name : email,
    picture: pictureFrom(strategy, info),
    meta: metaFrom(strategy, info),
    ...handleFrom(strategy, info),
    // -> Absent rather than empty when groups are not mapped: an empty list is the provider saying
    //    this person is in none, which with `unassignMissingGroups` on takes memberships away
    ...(groups
      ? {
          groups,
          groupsExclusive: conf.unassignMissingGroups === true
        }
      : {})
  }
}

/**
 * Hold the provider to having verified the email address, when the strategy requires it.
 *
 * The spec makes `email_verified` a JSON boolean, and `true` is the answer to expect. The rest of
 * what counts is what providers are known to send instead, all of it unambiguous: the string
 * `"true"` in any casing (Cognito sends `"true"`, a claim mapped from a string attribute or written
 * by Python's `str()` comes out `"True"`), and `1` or `"1"` from a provider storing the flag as an
 * integer column. Nothing looser — `"yes"` or `"verified"` is a value this would have to guess at,
 * and one it should refuse.
 *
 * Absent counts as not verified — this is the check that stops an address nobody proved they hold
 * from logging into the account that has it, so the direction for it to fail in is closed.
 *
 * @throws `ERR_EMAIL_NOT_VERIFIED`
 */
function checkEmailVerified(
  strategy: ClaimStrategy,
  info: Record<string, any>,
  email: string
): void {
  if (strategy.conf.requireVerifiedEmail !== true) {
    return
  }
  const claim = strategy.conf.verifiedEmailClaim || 'email_verified'
  const verified = readClaim(info, claim)
  const normalized = typeof verified === 'string' ? verified.trim().toLowerCase() : verified
  if (normalized !== true && normalized !== 1 && normalized !== 'true' && normalized !== '1') {
    strategyDebug(
      strategy,
      `the \`${claim}\` claim does not say <${email}> is verified (it says ${JSON.stringify(verified) ?? 'nothing'}), and this strategy requires a verified address (Verified Email Claim)`
    )
    throw new Error('ERR_EMAIL_NOT_VERIFIED')
  }
}

/**
 * The URL of the account's picture, if the claim carrying it names one.
 *
 * An empty claim name turns this off, which is how a wiki lets people keep an avatar they chose
 * here rather than having it replaced at every sign-in.
 */
function pictureFrom(strategy: ClaimStrategy, info: Record<string, any>): string | undefined {
  const claim = strategy.conf.pictureClaim ?? 'picture'
  if (!claim) {
    return undefined
  }
  const value = readClaim(info, claim)
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

/**
 * The profile fields the claims carry, for those an administrator has mapped.
 *
 * Every one is unmapped by default, so people keep what they set here. A mapped claim that is
 * missing from the answer leaves the field alone too — a provider that leaves a claim out has
 * usually not been asked for it (a scope, an attribute not released to this client), which is not
 * the same as saying the person has none. A claim that is present but empty does clear it.
 */
function metaFrom(strategy: ClaimStrategy, info: Record<string, any>): ProviderProfile['meta'] {
  const meta: ProviderProfile['meta'] = {}
  for (const [key, setting] of Object.entries(META_CLAIM_SETTINGS) as [
    ProviderProfileMetaKey,
    string
  ][]) {
    const claim = strategy.conf[setting]
    if (!claim) {
      continue
    }
    const value = readClaim(info, claim)
    if (typeof value !== 'string') {
      strategyDebug(
        strategy,
        `the \`${claim}\` claim carries no text for ${key}, which is left as it was`
      )
      continue
    }
    meta[key] = value
  }
  return meta
}

/**
 * The mention handle the claim carries, when one is mapped.
 *
 * Unmapped by default, and a mapped claim missing from the answer leaves the handle alone, for the
 * same reasons as `metaFrom`. Whether the value is a handle this wiki accepts, and whether it is
 * free, is decided where it is stored.
 */
function handleFrom(
  strategy: ClaimStrategy,
  info: Record<string, any>
): Pick<ProviderProfile, 'handle'> {
  const claim = strategy.conf.handleClaim
  if (!claim) {
    return {}
  }
  const value = readClaim(info, claim)
  if (typeof value !== 'string') {
    strategyDebug(
      strategy,
      `the \`${claim}\` claim carries no text for handle, which is left as it was`
    )
    return {}
  }
  return { handle: value }
}

/**
 * The group names the claim carries.
 *
 * Either one name or a list of them: a provider with a single group per account commonly sends the
 * bare string, and both forms mean the same thing here. Anything else in the list — a nested object
 * from a provider that sends group records rather than names — is skipped rather than stringified,
 * since a name that matches nothing is a membership silently not granted.
 */
function groupsFrom(strategy: ClaimStrategy, info: Record<string, any>): string[] {
  const claim = strategy.conf.groupsClaim || 'groups'
  const value = readClaim(info, claim)
  const raw = typeof value === 'string' ? [value] : Array.isArray(value) ? value : []
  const names = raw
    .filter((entry) => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim())
  /*
    Said even when it is empty, and especially then: a provider that emits the groups claim only for
    a client asking for the right scope — or only once the claim is configured on the application —
    answers with nothing here, which is not distinguishable on the wiki side from somebody genuinely
    being in no group.
  */
  strategyDebug(
    strategy,
    `the \`${claim}\` claim names ${names.length} group(s): ${names.join(', ') || 'none'}`
  )
  return names
}
