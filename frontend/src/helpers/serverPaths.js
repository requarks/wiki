/**
 * Paths the server owns rather than the page tree: build assets, the API, block bundles, uploaded
 * files, icons, per-site files and thumbnails. Avatars are the exception -- see `isServerPath`.
 *
 * One list, because two different things ask the same question of a URL and must not drift apart:
 * which links the router should keep its hands off (`renderedContent.js`), and which image sources
 * are already pointing at a file rather than at something to resolve (`renderers/markdown.js`).
 */
export const SERVER_PATHS = [
  '/_assets/',
  '/_api/',
  '/_blocks/',
  '/_files/',
  '/_icons/',
  '/_site/',
  '/_thumb/'
]

/**
 * Whether a root-relative path is one of them.
 *
 * `/_user/` is the one prefix the server shares with the router, so it is not in the list above: the
 * server serves avatars at `/_user/<id>/avatar`, while the app owns the public profile page at
 * `/_user/<id>`. A link to somebody's profile is therefore a link the router follows, and only the
 * avatar underneath it is a file. `backend/index.ts` splits the same segment the same way.
 */
export function isServerPath(path) {
  if (path.startsWith('/_user/')) {
    return path.endsWith('/avatar')
  }
  return SERVER_PATHS.some((prefix) => path.startsWith(prefix))
}
