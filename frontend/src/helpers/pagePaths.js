/**
 * The one spelling a page path is looked up under.
 *
 * Mirrors `normalizePagePath` in the backend's `helpers/common.ts`: wrapping slashes dropped,
 * whitespace to hyphens, lowercased and NFC-normalized. A path being WRITTEN goes through
 * `normalizeNewPagePath` instead, which also turns underscores into hyphens — a page written before
 * that rule may still have one, and looking it up through that would miss it.
 */
export function normalizePagePath(input) {
  return (input ?? '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replaceAll(/\s+/g, '-')
    .toLowerCase()
    .normalize('NFC')
}

/**
 * The spelling a page or folder path is written under: `normalizePagePath`, with every run of spaces,
 * underscores and hyphens turned into a single hyphen, and none left at either end of a segment.
 *
 * Mirrors `normalizeNewPagePath` in the backend's `helpers/common.ts`, so that a path typed into a
 * dialog is corrected in front of the person typing it rather than silently changed by the server
 * after they hit save. Whether what comes out is *allowed* is `isValidPathSegment`'s question.
 */
export function normalizeNewPagePath(input) {
  return (
    normalizePagePath((input ?? '').trim().replaceAll(/[\s_-]+/g, '-'))
      .split('/')
      // -> A hyphen only separates, so one left at either end of a segment is dropped
      .map((segment) => segment.replaceAll(/^-+|-+$/g, ''))
      .join('/')
  )
}

/**
 * Longest a path segment may be, in UTF-8 bytes. Mirrors `MAX_PATH_SEGMENT_BYTES` in the backend's
 * `helpers/common.ts`, which says where the number comes from.
 */
const MAX_PATH_SEGMENT_BYTES = 240

/** Letters and digits of any script, combining marks, and the hyphen -- never at either end. */
const PATH_SEGMENT = /^[\p{L}\p{M}\p{N}](?:[\p{L}\p{M}\p{N}-]*[\p{L}\p{M}\p{N}])?$/u

const utf8 = new TextEncoder()

/**
 * Whether a normalized segment is one a path may be written with. Mirrors `isValidPathSegment` in the
 * backend's `helpers/common.ts`.
 */
export function isValidPathSegment(segment) {
  return PATH_SEGMENT.test(segment) && utf8.encode(segment).length <= MAX_PATH_SEGMENT_BYTES
}

/**
 * A path segment as a dialog sends it: what `normalizeNewPagePath` makes of what was typed — unless
 * it is the name the page or folder already has, asked for again, which comes back exactly as it is.
 * The server does the same, so that renaming only the title of a page written before underscores
 * became hyphens does not move it.
 *
 * @param current The name it has now, when there is one
 */
export function pathSegmentToWrite(input, current = null) {
  return current !== null && normalizePagePath(input) === current
    ? current
    : normalizeNewPagePath(input)
}

/**
 * The path segment a title suggests, for a dialog that fills one in as the title is typed.
 *
 * Anything that cannot be in a segment becomes a hyphen rather than disappearing — `C++ Guide` is
 * `c-guide`, and `日本語・ガイド` is `日本語-ガイド` — and the result is cut to the byte limit on a whole
 * character.
 */
export function pathSegmentFromTitle(title) {
  const slug = (title ?? '')
    .toLowerCase()
    .normalize('NFC')
    .replaceAll(/[^\p{L}\p{M}\p{N}]+/gu, '-')
    .replaceAll(/^-+|-+$/g, '')
  let kept = ''
  let used = 0
  for (const char of slug) {
    used += utf8.encode(char).length
    if (used > MAX_PATH_SEGMENT_BYTES) {
      break
    }
    kept += char
  }
  return kept.replace(/-+$/, '')
}

/**
 * A URL path as the page path it spells: each segment percent-decoded.
 *
 * `route.path` is whatever the location was written as, because the router never decodes a path:
 * raw after the app pushes a raw string, percent-encoded after a reload or a click on a link in a
 * page, since the browser encodes what it puts in the address bar. So anything that compares a URL
 * with a page path, or hashes one, decodes it first. A segment that will not decode is not one a page
 * path could have produced, and is left as it is. Mirrors `decodeUrlPath` in the backend's
 * `helpers/common.ts`.
 */
export function decodeUrlPath(urlPath) {
  return (urlPath ?? '')
    .split('/')
    .map((segment) => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
    .join('/')
}

/**
 * Drop a site's page extension from the end of a URL path.
 *
 * The server redirects these too, but a link inside page content is followed by the router without
 * ever asking it — so `/foo/bar.md` written into a page has to resolve to `/foo/bar` here as well.
 * Mirrors `stripPageExtension` in the backend's `helpers/common.ts`.
 *
 * @param extensions Lowercase and without the dot, as `siteStore.pageExtensions` holds them
 * @returns The path without the extension, or null if it does not end in one of them
 */
export function stripPageExtension(urlPath, extensions) {
  if (!extensions?.length) {
    return null
  }
  const dot = urlPath.lastIndexOf('.')
  if (dot < 1 || urlPath[dot - 1] === '/' || urlPath.lastIndexOf('/') > dot) {
    return null
  }
  if (!extensions.includes(urlPath.slice(dot + 1).toLowerCase())) {
    return null
  }
  return urlPath.slice(0, dot)
}

/**
 * Which locale a page URL is addressed in, and what the path under it is.
 *
 * A site that brackets its URLs by locale reads `/fr/notes/one` as the page `notes/one` in French --
 * the first segment being the locale's SHORT code, the same one its content is filed under on a
 * storage target. The server redirects a request that reaches it, but a link inside a page is
 * followed by the router alone, so this mirrors `splitLocalePath` in the backend's `helpers/common.ts`
 * and the two have to read a path the same way.
 *
 * @param prefixes Map of short code to the locale it names, from `siteStore.localePrefixes`
 * @returns The locale and the path below it, or null when no segment names a locale
 */
export function splitLocalePath(urlPath, prefixes) {
  const slash = urlPath.indexOf('/', 1)
  const first = slash < 0 ? urlPath.slice(1) : urlPath.slice(1, slash)
  const locale = prefixes.get(first)
  if (!locale) {
    return null
  }
  // -> `/fr` alone is the French home page, which is `/` under the prefix
  return { locale, path: slash < 0 ? '/' : urlPath.slice(slash) }
}

/**
 * Files a browser or a crawler asks for at the root by convention, and the root segments this app's
 * own router owns despite carrying no leading underscore.
 *
 * Mirrors `RESERVED_ROOT_FILES` and `RESERVED_ROOT_PATHS` in the backend's `helpers/common.ts`.
 */
const RESERVED_ROOT = new Set(['favicon.ico', 'robots.txt', 'sitemap.xml', 'login', 'a', 'i'])

/**
 * Whether a URL addresses the page tree rather than the application itself.
 *
 * Everything the app mounts for itself sits under `/_…`, which is what makes this a prefix test
 * rather than a list — except for the sign-in form and the two short links to a page, `/a/<alias>`
 * and `/i/<id>`, which predate that convention.
 *
 * Mirrors `isPageUrl` in the backend's `helpers/common.ts`, and has to: the two answer the same
 * question about the same URL, one for a request that reaches the server and one for a link the
 * router follows on its own. Where they disagreed, `/login` was a page to one of them — locale
 * prefixed into `/en/login`, which matches no route at all.
 */
export function isPagePath(urlPath) {
  const firstSegment = (urlPath.split('/')[1] ?? '').toLowerCase()
  return !firstSegment.startsWith('_') && !RESERVED_ROOT.has(firstSegment)
}
