import crypto from 'node:crypto'
import { timingSafeCompare } from '../helpers/common.ts'

/**
 * The token an unsubscribe link carries: who it is for, and which categories the mail was about.
 *
 * `payload.signature`, both base64url, with an HMAC-SHA256 over the payload. Stateless on purpose —
 * there is nothing to store and nothing to look up, so the one-click endpoint answers a mail client
 * without a session, a cookie or a query beyond the write it makes.
 *
 * **It does not expire.** A link in a mail from last year has to work, and the only thing it can ever
 * do is turn email off for one person, which is not something anybody gains by forging.
 *
 * **Signed with its own secret**, `notifications.unsubscribeSecret`, generated on boot by the startup
 * checks (`core/startupChecks.ts`) wherever it is missing. Not `auth.secret`: that is rotated
 * whenever an administrator invalidates every session, and every unsubscribe link already sitting in
 * somebody's mailbox would stop working with it — the same reason `models/apiKeys.ts` gives the
 * signing certificates a passphrase of their own.
 */

/** The format version, so that a token written by a later shape can be told apart. */
const TOKEN_VERSION = 1

export interface UnsubscribeClaim {
  userId: string
  categories: string[]
}

function secret(): string {
  const value = WIKI.config.notifications?.unsubscribeSecret
  if (!value) {
    throw new Error('ERR_NOTIFICATIONS_NO_SECRET')
  }
  return value
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function createUnsubscribeToken({ userId, categories }: UnsubscribeClaim): string {
  const payload = Buffer.from(
    JSON.stringify({ v: TOKEN_VERSION, u: userId, c: [...new Set(categories)].sort() })
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

/**
 * What a token says, if it is genuine.
 *
 * @returns Null for anything that was not signed here, without saying which part was wrong
 */
export function readUnsubscribeToken(token: unknown): UnsubscribeClaim | null {
  if (typeof token !== 'string' || token.length > 2048) {
    return null
  }
  const [payload, signature, ...rest] = token.split('.')
  if (!payload || !signature || rest.length > 0) {
    return null
  }
  if (!timingSafeCompare(signature, sign(payload))) {
    return null
  }
  try {
    const claim = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (
      claim?.v !== TOKEN_VERSION ||
      typeof claim.u !== 'string' ||
      !Array.isArray(claim.c) ||
      !claim.c.every((key: unknown) => typeof key === 'string')
    ) {
      return null
    }
    return { userId: claim.u, categories: claim.c }
  } catch {
    return null
  }
}
