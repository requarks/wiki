/**
 * Icons, for blocks.
 *
 * A block draws an icon from the same reference the rest of the app uses — `mdi:account-edit` — and
 * gets it from this instance's own `/_icons`, which serves the part of the Iconify API protocol the
 * frontend speaks. Nothing here reaches Iconify itself: the server is what decides whether an icon
 * can be had, and an instance that is offline still answers for every icon it has been asked for
 * before.
 *
 * Shared because more than one block needs it, and one cache across all of them means a page whose
 * every row carries the same icon asks for it once.
 */

/** Icons already fetched, by `prefix:name`. Holds the promise, so concurrent callers share a request. */
const iconCache = new Map()

/**
 * Fetch an icon as inline SVG.
 *
 * Inline rather than an `<img>` so the drawing takes the colour of whatever it sits in — Iconify's
 * SVGs paint with `currentColor`, which an image cannot see. The instance serves them from its own
 * `/_icons`, cached hard, so this is a local request.
 *
 * An empty string for anything that is not a `prefix:name` reference, an icon the server will not
 * serve, or a request that failed: a missing icon is a row without one, not a row that breaks.
 *
 * @param {string} reference An Iconify reference, e.g. `mdi:home`.
 * @returns {Promise<string>} The SVG markup, or an empty string.
 */
export async function fetchIcon(reference) {
  if (iconCache.has(reference)) {
    return iconCache.get(reference)
  }
  const [prefix, name] = reference.split(':')
  if (!prefix || !name) {
    return ''
  }
  const promise = fetch(`/_icons/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`)
    .then((resp) => (resp.ok ? resp.text() : ''))
    .catch(() => '')
  iconCache.set(reference, promise)
  return promise
}

/**
 * The address an `img:` reference points at, or null for one that is not an image.
 *
 * The icon picker's other tab hands back `img:/_assets/icons/…`, which is a file to point an `<img>`
 * at rather than an icon to resolve — so it is the caller's to draw, and its colour is its own.
 *
 * @param {string} reference
 * @returns {string|null}
 */
export function iconImageUrl(reference) {
  return reference.startsWith('img:') ? reference.slice(4) : null
}
