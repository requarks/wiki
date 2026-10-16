import type { FastifyRequest, Session } from 'fastify'

/** The account a request acts as, in the shape the session has always carried it. */
export type RequestUser = NonNullable<Session['user']>

/**
 * The account a request acts as, or null when it acts as nobody.
 *
 * Two things carry a user: a signed-in session, and a personal access token, which is its owner
 * acting through the API. A system API key carries none — it acts for the groups it was issued for —
 * and takes precedence over a session riding along with it, the same precedence `actorForRequest`
 * gives its permissions, so that one request is never one credential's identity with another's
 * permissions.
 *
 * Every route a personal token can reach asks this rather than reading `req.session.user`, which a
 * token never fills in: writing to the session would have @fastify/session persist a row per call.
 */
export function requestUser(req: FastifyRequest): RequestUser | null {
  if (req.apiKey) {
    return req.apiKey.user
  }
  return req.session?.authenticated ? (req.session.user ?? null) : null
}

/** The ID of the account a request acts as, or null. See {@link requestUser}. */
export function requestUserId(req: FastifyRequest): string | null {
  return requestUser(req)?.id ?? null
}

/**
 * Whether the request carries a session the server can write to — i.e. a signed-in browser.
 *
 * What the profile routes check before refreshing the copy of the user the session keeps: a request
 * made with a personal token acts as the same user, but has no session copy to refresh.
 */
export function hasUserSession(req: FastifyRequest): boolean {
  return !req.apiKey && Boolean(req.session?.authenticated && req.session.user?.id)
}
