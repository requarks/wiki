/**
 * The scope categories of a personal access token, in the order the server declares them
 * (`TOKEN_SCOPE_CATEGORIES` in `backend/models/personalTokens.ts`). Each is a key of the API's own
 * `PersonalTokenScope` enum once `:read` or `:write` is added.
 *
 * The icons are literals so that `scripts/generate-icons.mjs` finds them and inlines them; a name
 * assembled at runtime would not be.
 */
export const TOKEN_SCOPE_CATEGORIES = [
  { key: 'pages', icon: 'la:file-alt' },
  { key: 'assets', icon: 'la:image' },
  { key: 'comments', icon: 'la:comments' },
  { key: 'glossary', icon: 'la:book' },
  { key: 'navigation', icon: 'la:sitemap' },
  { key: 'approvals', icon: 'la:check-double' },
  { key: 'profile', icon: 'la:user-circle' },
  { key: 'mcp', icon: 'mdi:robot-excited-outline' }
]

/** Whether a token has run past its expiration. */
export function isTokenExpired(token) {
  return (
    Temporal.Instant.compare(Temporal.Instant.from(token.expiration), Temporal.Now.instant()) <= 0
  )
}

/**
 * Why a token does not work, or null when it does: `invalidated` (the certificates were regenerated
 * after it was issued) before `expired`, since the first is the one nothing about the token itself
 * explains.
 */
export function tokenState(token) {
  if (token.isInvalidated) {
    return 'invalidated'
  }
  return isTokenExpired(token) ? 'expired' : null
}
