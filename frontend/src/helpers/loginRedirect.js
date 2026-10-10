/**
 * Where a login goes when it was on its way somewhere.
 *
 * A reader sent to the login screen because the page they asked for needs an account is sent back to
 * that page afterwards. The destination rides in the login URL as `?redirect=`, which is what keeps it
 * apart from a login somebody chose to make -- the Login button in the header goes to a plain
 * `/login`, and the site's Login Redirect and First-time Login Redirect settings (or a group's) decide
 * where that one lands. Those are the server's answer, `redirect` on a login response.
 *
 * The same parameter is what the server hands back after a provider login that failed, so a second
 * attempt still lands where the first was going.
 */

/**
 * Whether a value is a path on this wiki and so safe to send the browser to. Mirrors
 * `isLocalRedirectPath` in the backend's `helpers/common.ts`: the destination comes off a URL anybody
 * can write, and a login page that forwards to wherever it is told is a lure.
 */
export function isLocalRedirectPath(value) {
  // oxlint-disable-next-line no-control-regex -- matching control characters is the point
  return /^\/(?![/\\])/.test(value) && !/[\\\u0000-\u001f\u007f]/.test(value)
}

/**
 * Whether a value is something a login or logout redirect setting may hold: a path on this wiki or an
 * absolute `http(s)` URL. Mirrors `isRedirectTarget` in the backend's `helpers/common.ts`, which
 * refuses anything else on save. Checked here too because the browser navigates to it with
 * `location`, where a `javascript:` URL runs as script -- and a value stored before the server
 * checked, or by a 2.x import, never passed that test.
 */
export function isRedirectTarget(value) {
  if (isLocalRedirectPath(value)) {
    return true
  }
  // oxlint-disable-next-line no-control-regex -- matching control characters is the point
  if (/[\s\\\u0000-\u001f\u007f]/.test(value)) {
    return false
  }
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/** A redirect the server answered with, or the site root where it is missing or not navigable. */
export function redirectTargetOr(value) {
  return value && isRedirectTarget(value) ? value : '/'
}

/**
 * The login route for a reader on their way to `destination`.
 *
 * The site root carries nothing: it is where a login lands by default anyway, and saying so would
 * override the settings that exist to send it somewhere better.
 */
export function loginLocation(destination) {
  return isDestination(destination)
    ? { path: '/login', query: { redirect: destination } }
    : { path: '/login' }
}

/** The destination the current login screen was given, or null when it was opened on its own. */
export function loginDestination() {
  const destination = new URLSearchParams(window.location.search).get('redirect')
  return isDestination(destination) ? destination : null
}

/**
 * A path worth going back to: on this wiki, not the root (see `loginLocation`), and not the login
 * screen itself, which would only nest one destination inside another.
 */
function isDestination(value) {
  return isLocalRedirectPath(value ?? '') && value !== '/' && !/^\/login(?:[/?#]|$)/.test(value)
}
