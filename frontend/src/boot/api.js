import ky from 'ky'

/**
 * The HTTP client every call to the API goes through, exposed as the `API_CLIENT` global.
 *
 * Nothing is attached to a request beyond the session cookie: authentication is the `wikiSession`
 * cookie the server sets, sent because of `credentials`. There used to be a `beforeRequest` hook here
 * that refreshed a JWT and set an `Authorization` header — a leftover from when 3.x authenticated
 * with tokens. The user store it read has had no token since sessions replaced them, so the hook only
 * ever set an empty header. API keys still use bearer tokens, but those belong to callers outside
 * this app.
 */
export function initializeApi() {
  const client = ky.create({
    prefix: '/_api',
    credentials: 'same-origin',
    throwHttpErrors: (statusNumber) => statusNumber > 400, // Don't throw for 400
    /*
      ky retries by default, and both halves of that default are wrong for this API.

      `methods` includes `put` and `delete`, so a write that the server answered 500 or 503 to is
      sent again, twice, with no way for the caller to know -- and every write here is a page save,
      an upload or a login rather than something safe to repeat. Only GET and HEAD are.

      `statusCodes` includes 429, and 429 is in `afterStatusCodes`, so ky reads `Retry-After` and
      SLEEPS for it before trying again -- uncapped, since `maxRetryAfter` defaults to Infinity. This
      wiki's auth limiter answers a banned client with the remaining ban, up to 900 seconds
      (`helpers/rateLimit.ts`), so one rate-limited login sat silently under the "Signing in..."
      overlay for half an hour: two waits of fifteen minutes, no error, no redirect, and two further
      attempts spent against the very limit that refused it. A 429 from this API is a decision with a
      duration attached, not a blip -- it belongs in front of the user, not in a sleep.
    */
    retry: {
      methods: ['get', 'head'],
      statusCodes: [408, 500, 502, 503, 504],
      afterStatusCodes: []
    }
  })

  if (import.meta.env.SSR) {
    global.API_CLIENT = client
  } else {
    window.API_CLIENT = client
  }
}
