/**
 * The one spelling a page path has.
 *
 * Mirrors `normalizePagePath` in the backend's `helpers/common.ts`, so that a path typed into a
 * dialog is corrected in front of the person typing it rather than silently changed by the server
 * after they hit save. Whether what comes out is *allowed* is still each field's own rule — this only
 * settles casing and spaces.
 */
export function normalizePagePath(input) {
  return (input ?? '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replaceAll(/\s+/g, '-')
    .toLowerCase()
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
