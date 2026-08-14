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
    throwHttpErrors: (statusNumber) => statusNumber > 400 // Don't throw for 400
  })

  if (import.meta.env.SSR) {
    global.API_CLIENT = client
  } else {
    window.API_CLIENT = client
  }
}
