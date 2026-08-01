import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Time-based one-time passwords (RFC 6238), as every authenticator app implements them: HMAC-SHA1
 * over a 30-second counter, truncated to 6 digits, keyed by a base32 secret.
 *
 * Written here rather than pulled from a package because that is the whole of it — the algorithm is
 * a dozen lines, and the base32 codec it needs is another twenty. The parameters below are not
 * configurable on purpose: they are what an `otpauth://` URI means when it omits them, and an
 * authenticator app that reads a QR code has no way to be told anything else.
 */

/** Digits in a generated code. */
const codeDigits = 6

/** Seconds each code is valid for, before drift is taken into account. */
const periodSeconds = 30

/**
 * How many periods either side of the current one are accepted, i.e. a code stays usable for ±30s
 * around its own window. Clocks drift, and a user typing six digits routinely crosses a boundary.
 */
const allowedDrift = 1

/**
 * Bytes of entropy in a generated secret. 20 bytes is the SHA-1 block size and encodes to exactly 32
 * base32 characters with no padding, which is what authenticator apps expect to be handed.
 */
const secretBytes = 20

const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/**
 * Encode bytes as unpadded base32 (RFC 4648), the encoding `otpauth://` URIs use for secrets.
 */
function base32Encode(bytes: Buffer): string {
  let out = ''
  let bits = 0
  let value = 0
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += base32Alphabet[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  // -> A trailing group of fewer than 5 bits still carries data; pad it with zeroes on the right
  if (bits > 0) {
    out += base32Alphabet[(value << (5 - bits)) & 31]
  }
  return out
}

/**
 * Decode an unpadded or padded base32 string. Case-insensitive, and separators a user may have typed
 * are ignored — the secret is also displayed for manual entry, not only scanned.
 *
 * @throws If the value contains a character that is not base32
 */
function base32Decode(value: string): Buffer {
  const normalized = value.toUpperCase().replaceAll(/[\s-]/g, '').replaceAll('=', '')
  const bytes: number[] = []
  let bits = 0
  let acc = 0
  for (const char of normalized) {
    const index = base32Alphabet.indexOf(char)
    if (index < 0) {
      throw new Error(`Not a base32 character: ${char}`)
    }
    acc = (acc << 5) | index
    bits += 5
    if (bits >= 8) {
      bytes.push((acc >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

/**
 * The code a given secret produces for a given counter value.
 */
function codeAt(secret: Buffer, counter: number): string {
  const counterBytes = Buffer.alloc(8)
  counterBytes.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac('sha1', secret).update(counterBytes).digest()
  // -> Dynamic truncation: the low nibble of the last byte picks where in the digest to read from
  const offset = digest[digest.length - 1]! & 0x0f
  const binary = digest.readUInt32BE(offset) & 0x7fffffff
  return String(binary % 10 ** codeDigits).padStart(codeDigits, '0')
}

/**
 * A fresh TOTP secret, base32-encoded.
 */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(secretBytes))
}

/**
 * The `otpauth://` URI an authenticator app reads from the QR code.
 *
 * The label is `issuer:account` and the issuer is repeated as a parameter, which is what apps
 * actually key their entries on. Both are URI-encoded; a wiki title containing a `:` or a `?` would
 * otherwise produce a URI that parses as something else.
 *
 * @param secret Base32 secret, as returned by `generateTotpSecret()`
 * @param account Who the code belongs to, i.e. the user's email
 * @param issuer What it logs into, i.e. the site title
 */
export function buildTotpUri({
  secret,
  account,
  issuer
}: {
  secret: string
  account: string
  issuer: string
}): string {
  const label = encodeURIComponent(`${issuer}:${account}`)
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(codeDigits),
    period: String(periodSeconds)
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

/**
 * Whether a code is one the secret currently produces, allowing for clock drift.
 *
 * Compared byte-wise in constant time. That matters less here than for a password — a wrong code is
 * one of a million and expires in seconds — but the comparison is free to get right.
 *
 * @param secret Base32 secret stored for the user
 * @param code The six digits the user typed
 * @returns False for anything that is not six digits, or for a secret that will not decode
 */
export function verifyTotpCode(secret: string, code: string): boolean {
  if (!secret || !/^[0-9]{6}$/.test(code)) {
    return false
  }

  let secretKey: Buffer
  try {
    secretKey = base32Decode(secret)
  } catch {
    return false
  }
  if (secretKey.length < 1) {
    return false
  }

  const expected = Buffer.from(code, 'utf8')
  const counter = Math.floor(Date.now() / 1000 / periodSeconds)
  let matched = false
  for (let drift = -allowedDrift; drift <= allowedDrift; drift++) {
    // -> Every candidate is compared, rather than returning on the first hit, so that the work done
    //    does not depend on which window the code came from
    if (timingSafeEqual(Buffer.from(codeAt(secretKey, counter + drift), 'utf8'), expected)) {
      matched = true
    }
  }
  return matched
}
