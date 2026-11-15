/**
 * The message a failed API request should be reported with.
 *
 * The server's own, when it sent one — every `/_api` failure comes back as
 * `{ ok, error, statusCode, message }` — and ky's description of the request otherwise, which is all
 * there is for a failure that never reached a route.
 *
 * Read off `err.data`, never `err.response`: ky parses the body itself to fill `data` before it throws,
 * and that consumes it, so `err.response.json()` fails with "Body has already been read". Caught and
 * discarded — as it was everywhere this replaces — that failure is indistinguishable from a response
 * with no message, and the server's explanation gets quietly replaced by ky's generic "Request failed
 * with status code 503". Which is why a wrong password, a name already taken and a missing extension
 * all used to read the same.
 *
 * Synchronous, unlike the per-file helpers it replaces: with the body already parsed there is nothing
 * left to wait for, so callers read it straight out of the catch.
 *
 * @param {Error} err The thrown error — ky's `HTTPError`, or anything else that reached the catch
 * @param {string} [fallback] Shown when neither the server nor ky offered anything
 * @returns {string|undefined} What to put in front of the user
 */
export function apiErrorMessage(err, fallback) {
  return err?.data?.message || err?.message || fallback
}

/**
 * The message a `{ ok: false }` answer should be reported with — the 400s the API client resolves
 * rather than throws (`throwHttpErrors` in `boot/api.js`).
 *
 * A translation of the error's name when the locale has one (`<prefix>.<error>`), and the server's
 * own message otherwise. Never `t(key, resp.message)`: vue-i18n compiles a default message as message
 * syntax, so a server message holding `{`, `}`, `|` or `@` — a validation error quoting its pattern,
 * say — either comes out mangled or throws a compile error, which a production build reports as
 * nothing but its numeric code. That is how an invalid handle used to be reported as "7".
 *
 * @param {object} resp The parsed response body
 * @param {object} opts
 * @param {Function} opts.t The `t` of `useI18n()`
 * @param {Function} opts.te The `te` of `useI18n()`
 * @param {string} opts.prefix Where this screen's error translations live, e.g. `admin.users`
 * @param {string} opts.fallback Shown when the server sent no message either
 * @returns {string} What to put in front of the user
 */
export function apiFailureMessage(resp, { t, te, prefix, fallback }) {
  const key = `${prefix}.${resp?.error}`
  if (resp?.error && te(key)) {
    return t(key)
  }
  return resp?.message || fallback
}
