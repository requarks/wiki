/**
 * Paths the server owns rather than the page tree: build assets, the API, block bundles, uploaded
 * files, icons, per-site files, thumbnails and avatars.
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
  '/_thumb/',
  '/_user/'
]

/** Whether a root-relative path is one of them. */
export function isServerPath(path) {
  return SERVER_PATHS.some((prefix) => path.startsWith(prefix))
}
