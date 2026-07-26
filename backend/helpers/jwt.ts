import crypto from 'node:crypto'

/**
 * Minimal RS256 JWT signing and verification.
 *
 * Wiki.js generates an RSA keypair during installation and keeps it in `config.auth.certs`, so
 * tokens are signed with that key rather than with a shared secret. Only the RS256 algorithm is
 * accepted on the way in — a token asking for `none`, or for an HMAC algorithm that would turn the
 * public key into a signing secret, is rejected outright.
 */

export interface JwtClaims {
  [claim: string]: any
  /** Audience. Compared against the expected one during verification. */
  aud?: string
  /** Expiry, in seconds since the epoch. Required by `verifyJwt`. */
  exp?: number
  /** Issued at, in seconds since the epoch. */
  iat?: number
}

function encodeSegment(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function decodeSegment(segment: string): any {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'))
}

/** Seconds since the epoch, the unit JWT uses for `iat` / `exp`. */
export function epochSeconds(instant: Temporal.Instant = Temporal.Now.instant()): number {
  return Math.floor(instant.epochMilliseconds / 1000)
}

/**
 * Sign a set of claims.
 *
 * @param privateKey A key object, or a PEM string for an unencrypted key. The installation key is
 *                   passphrase-protected, so callers pass a `KeyObject` built with the passphrase.
 */
export function signJwt(claims: JwtClaims, privateKey: crypto.KeyObject | string): string {
  const payload = `${encodeSegment({ alg: 'RS256', typ: 'JWT' })}.${encodeSegment(claims)}`
  const signature = crypto.sign('RSA-SHA256', Buffer.from(payload), privateKey)
  return `${payload}.${signature.toString('base64url')}`
}

/**
 * Verify a token and return its claims.
 *
 * Throws with a specific message on every failure — a malformed token, a bad signature, an expired
 * token or the wrong audience — so callers can log the reason without inspecting the token again.
 */
export function verifyJwt(
  token: string,
  publicKey: crypto.KeyObject | string,
  { audience }: { audience?: string } = {}
): JwtClaims {
  const segments = token.split('.')
  if (segments.length !== 3) {
    throw new Error('Token is malformed.')
  }
  const [encodedHeader, encodedClaims, encodedSignature] = segments as [string, string, string]

  let header: any
  let claims: JwtClaims
  try {
    header = decodeSegment(encodedHeader)
    claims = decodeSegment(encodedClaims)
  } catch {
    throw new Error('Token is malformed.')
  }
  if (header?.alg !== 'RS256') {
    throw new Error('Token algorithm is not supported.')
  }
  if (!claims || typeof claims !== 'object') {
    throw new Error('Token is malformed.')
  }

  let isValid = false
  try {
    isValid = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${encodedHeader}.${encodedClaims}`),
      publicKey,
      Buffer.from(encodedSignature, 'base64url')
    )
  } catch {
    // -> A signature that is not even well-formed lands here rather than returning false
    isValid = false
  }
  if (!isValid) {
    throw new Error('Token signature is invalid.')
  }

  // -> A token with no expiry would be valid forever; treat its absence as a failure rather than as
  //    permission to skip the check
  if (typeof claims.exp !== 'number') {
    throw new Error('Token has no expiration.')
  }
  if (epochSeconds() >= claims.exp) {
    throw new Error('Token has expired.')
  }
  if (audience && claims.aud !== audience) {
    throw new Error('Token audience does not match.')
  }

  return claims
}
