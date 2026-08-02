import { durationToSeconds } from './common.ts'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { RateLimitPolicy } from '../models/rateLimits.ts'

/**
 * Defaults for the limit on the authentication endpoints, used until an administrator saves their own
 * and whenever a stored value is missing or unusable. Ten attempts in five minutes is far more than a
 * person signing in needs and far less than guessing a password takes.
 */
const AUTH_DEFAULTS: RateLimitPolicy = {
  max: 10,
  windowSeconds: 300,
  banSeconds: 900
}

/**
 * The configured policy.
 *
 * Every field falls back on its own, so one unusable value leaves the rest of the limit standing
 * rather than turning it off — which is the failure mode worth avoiding here. The two durations are
 * stored as an operator wrote them (`5m`, `15m`, `1d`), the way the JWT settings beside them are.
 */
function authPolicy(): RateLimitPolicy {
  const security = WIKI.config.security ?? {}
  const max = Number(security.authRateLimitMax)
  return {
    max: Number.isFinite(max) && max > 0 ? Math.floor(max) : AUTH_DEFAULTS.max,
    windowSeconds: durationToSeconds(security.authRateLimitWindow, AUTH_DEFAULTS.windowSeconds),
    banSeconds: durationToSeconds(security.authRateLimitBan, AUTH_DEFAULTS.banSeconds)
  }
}

/**
 * Refuse an attempt at an authentication endpoint once a client has made too many.
 *
 * Written as a per-route `onRequest` hook — `{ onRequest: limitAuthAttempts, schema: … }` — so that it
 * runs before the body is even parsed, and so that the routes it guards say so where they are declared
 * rather than in a list somewhere else. The endpoints that carry it are the ones where the request
 * IS the guess: signing in, answering a second factor, changing a password from the login screen,
 * a passkey ceremony, and unlocking a page.
 *
 * One counter per client address, shared by all of them: an attacker working through passwords on two
 * of these endpoints is one attacker, and splitting the count per endpoint would let them have the
 * limit twice over. `req.ip` is what the client is identified by, which behind a proxy means the
 * `trustProxy` security setting has to be on for this to see anything but the proxy.
 *
 * Attempts are counted whether or not they succeed. A limit on failures only would leave the endpoint
 * open to being hammered with valid credentials, and the numbers are set for a person signing in, who
 * does not come close to them.
 */
export async function limitAuthAttempts(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (WIKI.config.security?.authRateLimitEnabled === false) {
    return
  }
  const verdict = await WIKI.models.rateLimits.consume(`auth:${req.ip}`, authPolicy())
  if (verdict.allowed) {
    return
  }
  WIKI.models.flags.authDebug(
    `Rate limit: refused ${req.method} ${req.url} from ${req.ip}, ${verdict.retryAfter}s left of its ban.`
  )
  /*
    429 rather than 403, and with `Retry-After`: this is not a refusal to serve the client, it is the
    same answer as before with a time on it — which is what a legitimate user locked out by a shared
    address needs to be told.
  */
  reply.header('Retry-After', String(verdict.retryAfter))
  return reply.tooManyRequests(
    `Too many attempts. Try again in ${Math.ceil(verdict.retryAfter / 60)} minute(s).`
  )
}
