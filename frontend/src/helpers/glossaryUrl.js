/**
 * The glossary's half of the URL: `?glossary=<name>` opens the overlay on a term, over whatever page
 * the link was shared from, and `&glossaryLocale=<code>` names the locale when it is not the page's.
 * See `dev/specs/glossary.md` §7.
 *
 * A NAME rather than an id, so that a link reads as what it points at and survives a term being
 * deleted and written again; resolved through `GET /glossary/lookup`, which matches aliases too.
 * `?glossary` with no value is the overlay on its list, with nothing selected.
 */

/** The query parameter carrying the term. */
export const GLOSSARY_PARAM = 'glossary'

/** The query parameter carrying the locale, present only when it differs from the page's. */
export const GLOSSARY_LOCALE_PARAM = 'glossaryLocale'

/**
 * What a route asks of the glossary.
 *
 * @param {{ query: object }} route
 * @returns {{ name: string, locale: ?string } | null} Null when the route does not mention it;
 *          otherwise the name asked for, empty for the list.
 */
export function glossaryFromRoute(route) {
  if (!(GLOSSARY_PARAM in (route.query ?? {}))) {
    return null
  }
  return {
    // -> `?glossary` with no value reads as null, and `?glossary=a&glossary=b` as an array
    name: firstValue(route.query[GLOSSARY_PARAM]),
    locale: firstValue(route.query[GLOSSARY_LOCALE_PARAM]) || null
  }
}

/**
 * A query with the glossary's parameters set: `name` (null for the list) and the locale, which is
 * written only when it is not the one the page is in.
 */
export function withGlossary(query, { name = null, locale = null, pageLocale = null } = {}) {
  const next = withoutGlossary(query)
  next[GLOSSARY_PARAM] = name || null
  if (locale && locale !== pageLocale) {
    next[GLOSSARY_LOCALE_PARAM] = locale
  }
  return next
}

/** A query with the glossary's parameters taken out. */
export function withoutGlossary(query) {
  const next = { ...query }
  delete next[GLOSSARY_PARAM]
  delete next[GLOSSARY_LOCALE_PARAM]
  return next
}

/**
 * Whether a navigation changed nothing but the glossary's parameters -- browsing the glossary, which
 * must not scroll the page behind it.
 */
export function isGlossaryOnlyChange(to, from) {
  if (to.path !== from.path || to.hash !== from.hash) {
    return false
  }
  const a = withoutGlossary(to.query)
  const b = withoutGlossary(from.query)
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].every((key) => String(a[key]) === String(b[key]))
}

/**
 * The href of a link to a term over the page it is written on: `?glossary=<name>`. What an auto-link
 * carries, and what an author writes by hand.
 */
export function glossaryHref(name) {
  return `?${GLOSSARY_PARAM}=${encodeURIComponent(name)}`
}

/**
 * The term a link points at, when it is a glossary link to the page it sits on.
 *
 * Only that page: `/other/page?glossary=REST` is a link to another page, which happens to open the
 * glossary once there, and is left to the router like any other.
 *
 * @param {HTMLAnchorElement} anchor
 * @returns {{ name: string, locale: ?string } | null}
 */
export function glossaryLinkTarget(anchor) {
  const href = anchor?.getAttribute?.('href')
  if (!href || !href.includes(GLOSSARY_PARAM)) {
    return null
  }
  let url
  try {
    url = new URL(anchor.href)
  } catch {
    return null
  }
  if (url.origin !== window.location.origin || url.pathname !== window.location.pathname) {
    return null
  }
  const name = url.searchParams.get(GLOSSARY_PARAM)
  return name
    ? { name: name.trim(), locale: url.searchParams.get(GLOSSARY_LOCALE_PARAM) || null }
    : null
}

function firstValue(value) {
  const one = Array.isArray(value) ? value[0] : value
  return typeof one === 'string' ? one.trim() : ''
}
