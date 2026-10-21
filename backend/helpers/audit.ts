import { requestUser } from './requester.ts'
import { currentVia } from './via.ts'
import type { FastifyRequest } from 'fastify'
import type { AuditAction, AuditActor, AuditKind } from '../models/auditLog.ts'

/**
 * Key names whose value never belongs in the audit log.
 *
 * This is a backstop, not the rule. The rule is that a route hands `audit()` the identity of what it
 * touched — an id, a path, a name — and not the payload it touched it with, which is why nearly every
 * call site passes a handful of scalars. What this catches is the case where somebody later widens
 * one of those calls to `req.body` and does not notice that the body carries a module's sensitive
 * prop.
 *
 * Two lists rather than one, because the useful patterns come in two lengths. A long name can be
 * matched anywhere in the key — `token` has to catch `continuationToken` — while a short one has to
 * match the whole key or it starts eating innocent fields: `pass` as a substring redacts `passkeyId`,
 * and `key` as a substring redacts every foreign key in here.
 */
const SENSITIVE_SUBSTRINGS = [
  'password',
  'passwd',
  'secret',
  'token',
  'credential',
  'privatekey',
  'apikey',
  'accesskey',
  'authorization',
  'authheader',
  'securitycode'
]

/** Short, generic names that are only sensitive when they are the whole key. */
const SENSITIVE_EXACT = new Set([
  'pass',
  'key',
  'salt',
  'hash',
  'otp',
  'session',
  'certs',
  'cookie'
])

/** What a redacted value is replaced with, so that the shape of the meta is still readable. */
const REDACTED = '[redacted]'

/** How deep `sanitizeMeta` walks before it stops descending. */
const MAX_DEPTH = 6

function isSensitiveKey(key: string): boolean {
  const lowered = key.toLowerCase()
  return (
    SENSITIVE_EXACT.has(lowered) ||
    SENSITIVE_SUBSTRINGS.some((pattern) => lowered.includes(pattern))
  )
}

/**
 * Replace the value of any sensitive-looking key, however deeply nested.
 *
 * Returns a new structure; the caller's object is never modified. Anything that is not a plain object
 * or array is passed through as-is, so a `Date` or a `Buffer` reaching here stays what it was and is
 * left for `JSON.stringify` to deal with on its way into the jsonb column.
 */
export function sanitizeMeta(value: unknown, depth = 0): any {
  if (depth > MAX_DEPTH) {
    return REDACTED
  }
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeMeta(entry, depth + 1))
  }
  if (value === null || typeof value !== 'object' || !isPlainObject(value)) {
    return value
  }
  const cleaned: Record<string, any> = {}
  for (const [key, entry] of Object.entries(value)) {
    cleaned[key] = isSensitiveKey(key) ? REDACTED : sanitizeMeta(entry, depth + 1)
  }
  return cleaned
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** Who is making this request, as the audit log records them. */
function actorFromRequest(req: FastifyRequest): AuditActor {
  const user = requestUser(req)
  return {
    id: user?.id ?? null,
    name: user?.name ?? null,
    email: user?.email ?? null,
    ip: req.ip
  }
}

/**
 * Record one action in the audit log, as the request that made it.
 *
 * Called from API route handlers, AFTER the action has succeeded — an audit log says what happened,
 * and a row written before the work would claim something that a later `throw` never did. Being
 * called from a route is also what keeps the scheduler out of the log: a page the git sync imports
 * reaches the same model method by a path that never comes through here.
 *
 * This is how nearly everything is recorded. The exceptions are the auth events whose actor is not
 * on the session yet — a login, a registration, a password reset from an emailed link — where the
 * account is only identified deep inside `models/users.ts` by a credential or a token; those call
 * `auditLog.record` directly, with the account they have just resolved. A logout is the mirror image:
 * the session is destroyed before the entry is written, so it too passes its own actor.
 *
 * Awaiting it is optional and mostly pointless — `auditLog.record` swallows its own failures — but
 * every call site does, so that a route's last statement is not a floating promise the response can
 * outrun.
 *
 * A request authenticated by a system API key rather than a session is recorded with no user: a key
 * acts with the permissions of its groups, not as a person, and `meta.apiKeyId` is what identifies it.
 * A personal access token acts as its owner and is recorded as them, with `meta.patId` saying it was
 * the token rather than a browser — not `tokenId`, which `sanitizeMeta` would take for a secret.
 *
 * Anything done through the MCP server adds `meta.via: 'mcp'`, which is what tells an AI assistant's
 * action apart from a script's with the same token. Read off the `withVia` scope rather than passed
 * by each caller, so that a REST route the MCP server calls in-process records it without knowing it
 * was asked by an assistant.
 *
 * @param kind Which area of the wiki the action belongs to
 * @param action What was done, as a key from `AUDIT_ACTIONS`
 * @param meta The identity of what was touched. Never a payload, and never a secret.
 */
export async function audit(
  req: FastifyRequest,
  kind: AuditKind,
  action: AuditAction,
  meta: Record<string, any> = {}
): Promise<void> {
  const via = currentVia()
  const withKey = !req.apiKey
    ? meta
    : req.apiKey.kind === 'personal'
      ? { ...meta, patId: req.apiKey.id }
      : { ...meta, apiKeyId: req.apiKey.id }
  await WIKI.models.auditLog.record({
    kind,
    action,
    actor: actorFromRequest(req),
    meta: via ? { ...withKey, via } : withKey
  })
}
