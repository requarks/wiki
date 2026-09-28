import path from 'node:path'
import * as cheerio from 'cheerio'
import { isPageUrl, normalizePagePath, splitLocalePath, stripPageExtension } from './common.ts'

/**
 * Reading a link the way the reader's browser will.
 *
 * A page stores the HTML its editor produced, and that HTML carries the href the author wrote:
 * `fileSrc` rewrites image sources and deliberately leaves links alone, because a relative link means
 * exactly what it says. So `../two`, `/en/one/two`, `/one/two.md` and
 * `https://wiki.example.com/en/one/two` can all be the same page, and something has to say so before
 * any question about links can be answered.
 *
 * That makes this the THIRD copy of the rules for reading a page URL, after `helpers/common.ts` —
 * which it composes rather than reimplements — and `frontend/src/helpers/pagePaths.js`. It has to
 * agree with both: a link this reads differently from the router is a backlink pointing somewhere the
 * reader does not land.
 */

/**
 * Every href in a render, exactly as written and with repeats left in.
 *
 * A page's links are read from its stored HTML rather than from its source, because there is no
 * markdown parser on this side at all: the render is produced in the editor's browser and sent up,
 * and it is the one settled form of a page the server holds. It is also what makes rebuilding a
 * wiki's links cost a parse per page instead of a headless browser per page.
 *
 * @param $ A document already loaded, for the caller that has one — `postProcess` is holding the very
 *          tree this would otherwise re-parse.
 */
export function hrefsFrom($: cheerio.CheerioAPI): string[] {
  const hrefs: string[] = []
  for (const el of $('a[href]')) {
    const href = $(el).attr('href')
    if (href) {
      hrefs.push(href)
    }
  }
  return hrefs
}

/** The same, for a stored render with nothing loaded — which is every page but the one being saved. */
export function linksFromRender(html?: string | null): string[] {
  if (!html) {
    return []
  }
  return hrefsFrom(cheerio.load(html, null, false))
}

/** What a link addresses. See the `kind` column. */
export type PageLinkKind = 'page' | 'alias' | 'pageId' | 'asset'

export interface ResolvedLink {
  kind: PageLinkKind
  /** The href as written, which is what a repair has to find in the source again. */
  href: string
  /** Which site the target is on — the source's own, unless the href named another one. */
  targetSiteId: string
  /** Where the target sits, for the two kinds that say. Null for `alias` and `pageId`. */
  targetLocale: string | null
  targetPath: string | null
  /** The alias or the page id, for the two kinds that carry one. */
  targetRef: string | null
}

/** Where a page sits, which is what a link to it has to say. */
export interface LinkTarget {
  siteId: string
  locale: string
  path: string
}

/** The page a link is written on, which is what a relative href resolves against. */
export interface LinkSource {
  siteId: string
  locale: string
  path: string
}

/**
 * The origin every href is resolved against.
 *
 * Nothing here cares what the host is, only whether two of them are the same, and a render is
 * processed outside any request — so there is no real origin to reach for. A placeholder that cannot
 * collide with a hostname anybody has configured is what makes `new URL()` usable on a relative href,
 * and comparing what comes out against this is how "did this link stay on this site" is asked.
 */
const LOCAL_ORIGIN = 'https://page-links.invalid'

/** Where uploaded files are served from, and the one non-page path worth recording. */
const FILES_PREFIX = '/_files/'

/** The short links to a page that survive a move, and the segment each is addressed by. */
const ALIAS_PREFIX = '/a/'
const PAGE_ID_PREFIX = '/i/'

/**
 * The longest href that gets a row, matching the column it is stored in.
 *
 * Not a judgement about what a link may be — it is what a unique btree index can hold, and the insert
 * is part of saving a page. Past it the link is not recorded, which costs a row in a derived table
 * and never the save.
 */
const MAX_HREF_LENGTH = 2048

/**
 * Which site an href ended up on, or null when it left the instance.
 *
 * A link written as an absolute URL to another site of this wiki is followed rather than written off:
 * `WIKI.sitesMappings` is the same lookup the request hooks do, so a second site's hostname resolves
 * to that site and a move there breaks the link just as visibly.
 *
 * **The catch-all mapping is deliberately not consulted.** `*` answers for every hostname that
 * reaches this server, so honouring it here would make every external link a page link — every URL a
 * page cites would resolve to a path on the site that happens to be bound to `*`. The cost is the
 * other half of that: on a site with no hostname of its own, a link somebody wrote by pasting the
 * address out of their browser is not recognised as internal, because there is nothing configured to
 * recognise it against. Links written as paths — which is every link the link picker produces — never
 * reach this at all, and are unaffected.
 */
function siteForHost(hostname: string, sourceSiteId: string): string | null {
  if (hostname === new URL(LOCAL_ORIGIN).hostname) {
    return sourceSiteId
  }
  return WIKI.sitesMappings?.[hostname] ?? null
}

/**
 * Read one href as the address of something in this wiki, or null when it is not one.
 *
 * Null covers rather a lot, and all of it on purpose: an empty href, a bare fragment, a `mailto:` or
 * `tel:`, a link to another server, and every path the wiki serves for itself — `/_admin`, `/login`,
 * `/_api` — none of which is content this can be asked a question about. Links leaving the wiki are
 * not recorded at all; see the `kind` column.
 *
 * @param source The page the link is written on. A relative href resolves against the URL that page
 *               is served at, locale prefix and all, which is what the browser following it does.
 */
export function resolveLink(href: string, source: LinkSource): ResolvedLink | null {
  const raw = (href ?? '').trim()
  if (raw.length < 1 || raw.length > MAX_HREF_LENGTH || raw.startsWith('#')) {
    return null
  }

  /*
    A scheme that is not http(s) is not a page under any reading -- `mailto:`, `tel:`, `data:`, and
    the `javascript:` a sanitised render should not be carrying anyway. Tested before `new URL()`
    rather than after, since those parse perfectly well and would otherwise have to be excluded by
    protocol afterwards.
  */
  if (/^[a-z][a-z\d+.-]*:/i.test(raw) && !/^https?:/i.test(raw)) {
    return null
  }

  let url: URL
  try {
    // -> The page's own address as the base, so `../two` from `one/deep/three` lands where a reader
    //    clicking it lands. `urlFor` is what puts the site's locale prefix on it, if it uses one
    url = new URL(
      raw,
      `${LOCAL_ORIGIN}${WIKI.models.pages.urlFor(source.siteId, source.locale, source.path)}`
    )
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return null
  }

  const targetSiteId = siteForHost(url.hostname, source.siteId)
  if (!targetSiteId) {
    return null
  }

  // -> The query and the fragment address a part of the target, never a different one, so what is
  //    left is the whole of where the link goes
  const urlPath = url.pathname

  if (urlPath.startsWith(ALIAS_PREFIX)) {
    const alias = decodeURIComponent(urlPath.slice(ALIAS_PREFIX.length)).replace(/\/+$/, '')
    return alias.length > 0
      ? {
          kind: 'alias',
          href: raw,
          targetSiteId,
          targetLocale: null,
          targetPath: null,
          targetRef: alias
        }
      : null
  }
  if (urlPath.startsWith(PAGE_ID_PREFIX)) {
    const id = decodeURIComponent(urlPath.slice(PAGE_ID_PREFIX.length)).replace(/\/+$/, '')
    return id.length > 0
      ? {
          kind: 'pageId',
          href: raw,
          targetSiteId,
          targetLocale: null,
          targetPath: null,
          targetRef: id
        }
      : null
  }

  if (urlPath.startsWith(FILES_PREFIX)) {
    return resolveFile(raw, urlPath, targetSiteId)
  }

  if (!isPageUrl(urlPath)) {
    return null
  }
  return resolvePage(raw, urlPath, targetSiteId)
}

/**
 * A page address, as the SEO hook and the router between them read one.
 *
 * Same order as `index.ts`: the extension comes off first, since `/en/one/two.md` carries both, and
 * the locale prefix second. A path arriving without a prefix is the site's primary locale, which is
 * where the server redirects it and what the app loads for it.
 */
function resolvePage(href: string, urlPath: string, targetSiteId: string): ResolvedLink | null {
  const site = WIKI.sites?.[targetSiteId]
  const trimmed = urlPath.length > 1 && urlPath.endsWith('/') ? urlPath.slice(0, -1) : urlPath

  const withoutExtension = stripPageExtension(trimmed, site?.config?.pageExtensions) ?? trimmed

  const locales = site?.config?.locales
  const split = splitLocalePath(
    withoutExtension,
    WIKI.models.locales.urlPrefixesFor(locales?.active)
  )

  return {
    kind: 'page',
    href,
    targetSiteId,
    // -> A path with no prefix names the primary locale, which is where the SEO hook redirects it
    //    and what the app loads for it. Same fallback as `pages.defaultLocale`
    targetLocale: split?.locale ?? locales?.primary ?? 'en',
    // -> The site root is the page stored at the empty path, which is what `normalizePagePath` makes
    //    of `/` -- and of `/fr` once its prefix has come off above
    targetPath: normalizePagePath(split?.path ?? withoutExtension),
    targetRef: null
  }
}

/**
 * An uploaded file, addressed the way `controllers/files.ts` serves one.
 *
 * `/_files/<folders…>/<name.ext>`, and no locale segment: a file URL names a path and nothing else,
 * and `getAssetByPath` picks the site's primary locale among the translations filed under it. So
 * unlike a page link there is no locale to record — the path IS the address.
 *
 * Lowercased whole, which is how the lookup reads it: the tree stores a file name in lower case and
 * `resolveAssetPath` keys its cache on the path in lower case, so two spellings of one file must not
 * become two targets here.
 *
 * Recorded for the same reason a page link is: a file moves when the folder holding it is renamed,
 * and what pointed at it is the thing worth knowing.
 */
function resolveFile(href: string, urlPath: string, targetSiteId: string): ResolvedLink | null {
  const rest = decodeURIComponent(urlPath.slice(FILES_PREFIX.length))
    .split('/')
    .filter(Boolean)
    .join('/')
    .toLowerCase()
  if (rest.length < 1) {
    return null
  }
  return {
    kind: 'asset',
    href,
    targetSiteId,
    targetLocale: null,
    targetPath: rest,
    targetRef: null
  }
}

/**
 * The class a stored render puts on a link to a page that is not there — a red link.
 *
 * Owned by the server, not the author: it is set and cleared on every anchor each time a render is
 * checked, so one written by hand is taken off again wherever the page it points at exists. Whether it
 * is DRAWN red is a separate, per-site question the page view answers with a class on the contents
 * container (`colorizeBrokenLinks`), which is what lets the setting change without a single page
 * being rewritten. `frontend/src/css/_page-contents.scss` is the other half of this name.
 */
export const BROKEN_LINK_CLASS = 'is-broken-link'

/**
 * Put the broken-link class on exactly the anchors whose href is in `broken`, and take it off every
 * other one.
 *
 * Matched on the href as written (trimmed, as `resolveLink` keys it), which is what the `pageLinks`
 * rows hold — so the same href written twice on a page is marked twice, and two spellings of one
 * missing page are both marked.
 *
 * @returns The render with the classes corrected, or null when not one anchor had to change — the
 *          common case, and one that must not cost a write.
 */
export function markBrokenLinks(html: string, broken: ReadonlySet<string>): string | null {
  // -> Nothing to add, and nothing there to take off: skip the parse. The substring test can only
  //    give a false positive (an author's own text mentioning the name), never a false negative
  if (broken.size < 1 && !html.includes(BROKEN_LINK_CLASS)) {
    return null
  }

  const $ = cheerio.load(html, null, false)
  let changed = false
  for (const el of $('a')) {
    const anchor = $(el)
    const isBroken = broken.has((anchor.attr('href') ?? '').trim())
    if (isBroken === anchor.hasClass(BROKEN_LINK_CLASS)) {
      continue
    }
    changed = true
    if (isBroken) {
      anchor.addClass(BROKEN_LINK_CLASS)
    } else {
      anchor.removeClass(BROKEN_LINK_CLASS)
      // -> A link that only ever had this class goes back to having none, rather than `class=""`
      if (!(anchor.attr('class') ?? '').trim()) {
        anchor.removeAttr('class')
      }
    }
  }
  return changed ? $.html() : null
}

/**
 * The same link, rewritten to point at where its target now is — for a page that moved.
 *
 * Written the way the author wrote it rather than normalized, because the href is going back into
 * their source: a relative link stays relative (from where the page holding it now sits), an absolute
 * path stays absolute, a full URL keeps its host, and whatever the old one carried beyond the page —
 * a locale prefix it did not strictly need, a page extension, a query, a fragment — is carried over.
 * The one thing deliberately not kept is a trailing slash, which the resolver ignores anyway.
 *
 * Checked against `resolveLink` before it is handed back, so a spelling that would land somewhere
 * else — a relative climb that no longer fits, a prefix the site stopped using — falls back to the
 * plain absolute path, which always lands.
 *
 * @param source Where the page holding the link sits NOW, which is what a relative href resolves
 *               against — for a page linking to itself, that is its new address.
 * @returns The new href, or null when `href` does not address a page at all.
 */
export function relinkHref(href: string, source: LinkSource, target: LinkTarget): string | null {
  const raw = (href ?? '').trim()
  const resolved = resolveLink(raw, source)
  if (resolved?.kind !== 'page') {
    return null
  }
  const url = new URL(
    raw,
    `${LOCAL_ORIGIN}${WIKI.models.pages.urlFor(source.siteId, source.locale, source.path)}`
  )

  // -> The query and fragment exactly as written, which is not always how `URL` re-serializes them
  const suffixAt = raw.search(/[?#]/)
  const suffix = suffixAt < 0 ? '' : raw.slice(suffixAt)

  const site = WIKI.sites?.[target.siteId]
  const trimmed =
    url.pathname.length > 1 && url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname
  const withoutExtension = stripPageExtension(trimmed, site?.config?.pageExtensions)
  const extension = withoutExtension === null ? '' : trimmed.slice(withoutExtension.length)
  const hadPrefix = Boolean(
    splitLocalePath(
      withoutExtension ?? trimmed,
      WIKI.models.locales.urlPrefixesFor(site?.config?.locales?.active)
    )
  )

  const plainPath = WIKI.models.pages.urlFor(target.siteId, target.locale, target.path)
  let urlPath = hadPrefix
    ? `/${WIKI.models.locales.shortCodeFor(target.locale)}/${target.path}`
    : plainPath
  // -> `/.md` addresses nothing, so the site root never takes an extension
  if (extension && target.path) {
    urlPath += extension
  }
  // -> A prefixed root is `/fr/`, which reads as `/fr` either way; written without the slash
  if (urlPath.length > 1 && urlPath.endsWith('/')) {
    urlPath = urlPath.slice(0, -1)
  }

  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(raw)
  let rewritten: string
  if (hasScheme) {
    rewritten = `${url.origin}${urlPath}${suffix}`
  } else if (raw.startsWith('//')) {
    rewritten = `//${url.host}${urlPath}${suffix}`
  } else if (raw.startsWith('/')) {
    rewritten = `${urlPath}${suffix}`
  } else {
    const from = path.posix.dirname(
      WIKI.models.pages.urlFor(source.siteId, source.locale, source.path)
    )
    const relative = path.posix.relative(from, urlPath)
    rewritten = relative ? `${relative}${suffix}` : `${urlPath}${suffix}`
  }

  const check = resolveLink(rewritten, source)
  const lands =
    check?.kind === 'page' &&
    check.targetSiteId === target.siteId &&
    check.targetLocale === target.locale &&
    check.targetPath === target.path
  if (lands) {
    return rewritten
  }
  return hasScheme ? `${url.origin}${plainPath}${suffix}` : `${plainPath}${suffix}`
}

/**
 * Replace hrefs in a render, anchor by anchor.
 *
 * The render half of relinking a moved page: the source is rewritten by `helpers/linkRewrite.ts`, and
 * the stored HTML has to say the same thing without waiting for somebody to re-render it — the
 * render is what a reader is served.
 *
 * @param replacements Old href (trimmed, as the `pageLinks` rows hold it) to new href.
 * @returns The rewritten render, or null when no anchor carried any of them.
 */
export function rewriteRenderLinks(
  html: string,
  replacements: ReadonlyMap<string, string>
): string | null {
  if (replacements.size < 1 || !html) {
    return null
  }
  const $ = cheerio.load(html, null, false)
  let changed = false
  for (const el of $('a[href]')) {
    const anchor = $(el)
    const replacement = replacements.get((anchor.attr('href') ?? '').trim())
    if (replacement !== undefined) {
      anchor.attr('href', replacement)
      changed = true
    }
  }
  return changed ? $.html() : null
}
