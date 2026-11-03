/**
 * The address an author gave a block, as a URL a browser may load into the page -- or null.
 *
 * A block's props are written by whoever wrote the page, and Lit puts a value into `src` or `href`
 * exactly as it is: a `javascript:` URL there is script, run in the wiki's own origin as whoever is
 * reading. So anything a block turns into a frame or a link goes through here first, and only `http:`
 * and `https:` come back. Resolved against the page, so a path on this wiki is an address too.
 *
 * @param {string} value
 * @returns {URL|null}
 */
export function webUrl(value) {
  try {
    const url = new URL(String(value ?? '').trim(), window.location.href)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}
