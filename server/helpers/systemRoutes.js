/**
 * Single-letter system routes (Wiki.js conventions).
 * Only /t (tags) is reachable by guest users; all others require login.
 */
const AUTH_REQUIRED_PREFIXES = new Set(['a', 'c', 'd', 'e', 'f', 'h', 'i', 'p', 's', 'u', 'w'])
const GUEST_ALLOWED_PREFIXES = new Set(['t'])

function isGuestUser (user) {
  return !user || user.id < 1 || user.id === 2
}

function isAuthenticatedUser (user) {
  return !isGuestUser(user)
}

function setLoginRedirectCookie (req, res) {
  res.cookie('loginRedirect', req.originalUrl.split('?')[0], {
    maxAge: 15 * 60 * 1000
  })
}

function redirectGuestToLogin (req, res) {
  setLoginRedirectCookie(req, res)
  return res.redirect('/login')
}

/**
 * Redirect guest users to login for protected system routes.
 * @returns {boolean} true when the request was handled (caller should return)
 */
function denyGuestSystemRoute (req, res) {
  if (!isGuestUser(req.user)) {
    return false
  }
  redirectGuestToLogin(req, res)
  return true
}

function getSystemRoutePrefix (urlPath) {
  const segments = (urlPath || '').split('?')[0].split('/').filter(Boolean)
  const prefix = segments[0] || ''
  if (prefix.length === 1 && AUTH_REQUIRED_PREFIXES.has(prefix)) {
    return prefix
  }
  return null
}

function isAuthRequiredSystemPrefix (prefix) {
  return AUTH_REQUIRED_PREFIXES.has(prefix)
}

module.exports = {
  AUTH_REQUIRED_PREFIXES,
  GUEST_ALLOWED_PREFIXES,
  isGuestUser,
  isAuthenticatedUser,
  denyGuestSystemRoute,
  redirectGuestToLogin,
  setLoginRedirectCookie,
  getSystemRoutePrefix,
  isAuthRequiredSystemPrefix
}
