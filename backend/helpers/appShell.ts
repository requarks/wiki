import * as cheerio from 'cheerio'
import type { FastifyRequest } from 'fastify'
import type { PageDescription } from '../models/pages.ts'
import { htmlEscape, isPageUrl, normalizePagePath, originOf, splitLocalePath } from './common.ts'

/**
 * What the app shell is enriched with before it is handed to a client that will not run it.
 *
 * The compiled SPA is one document for every path on the wiki: a `<title>` reading `Wiki.js`, no
 * description, and an empty `<div id="app">` that only means something once a browser has run the
 * bundle. Anything that does not — a chat client building an unfurl card, an AI crawler, a search
 * engine that does not render, a reader with JavaScript off — sees exactly that, for every page.
 *
 * This is the cheap half of the fix, and it is cheap because there is nothing to render: a page's
 * HTML is already a string in `pages.render`, produced once in the editor at save time. So a document
 * for a crawler is the shell plus that string plus a handful of meta tags, and the server never runs
 * a renderer, a component tree or a second build to produce one. See the note on caching below for
 * what a scrape actually costs.
 *
 * There are two kinds of document, and which one a request gets turns on whether it will run the app:
 *
 *  - **A client that will not** — `fragmentsForCrawler` — gets the public's view of the page: a head
 *    describing it, its markup appended, and 404 where the public may read nothing there. What goes
 *    in is what the GUESTS group may read and nothing else, which is what makes it the same document
 *    for whoever asked, and therefore the half that is cached and handed on.
 *  - **A browser that will** — `fragmentsForBrowser` — gets the head alone, describing the page as
 *    THAT reader may see it. It still matters that the title is right: the document's own title is
 *    what the tab reads while the bundle loads and what a bookmark made before it finishes keeps.
 *
 * Two further rules hold across both:
 *
 *  - **Nothing is rendered, and nothing runs.** The injected copy is the stored render with its
 *    scripts and styles taken out — see `stripActiveMarkup`.
 *  - **Nothing a requester holds reaches the cache.** Only the public half is cached, keyed by origin
 *    and path with no session dimension, because there is nothing in it that varies by requester.
 */

/** Namespaced so the whole lot can be dropped without knowing which hosts or paths are in it. */
const SHELL_CACHE_PREFIX = 'appShell:'

/**
 * How long an assembled fragment set is held, in seconds.
 *
 * The same figure as the sitemap's, for the same reason: a title or a description a few minutes out
 * of date misleads nobody, and the alternative is reading a page out of the database for every scrape
 * of it. What waits for the TTL is an edit showing up in an unfurl card — the wiki itself never shows
 * a stale page, since everyone who can edit one is logged in and is served the live app.
 */
const SHELL_CACHE_TTL = 600

/**
 * How many fragment sets are held at once.
 *
 * A crude ceiling rather than an eviction order: at the limit the whole namespace goes and fills
 * again. Nothing here is worth the bookkeeping a least-recently-used cache would need — a wiki whose
 * public traffic fits in this many pages gets a perfect hit rate, and one being crawled end to end
 * gets little from caching either way, since a crawler fetches each page once.
 *
 * Having a ceiling at all is the point, and it is not about a wiki's size: the key carries the
 * request's own host (see `cacheKeyFor`), so without one anybody could grow this without limit by
 * asking for the same page under a made-up hostname.
 */
const SHELL_CACHE_MAX_ENTRIES = 500

/** The site root, as the path below a locale prefix comes back — `/fr` alone is `/` in French. */
const ROOT_PATHS = new Set(['', '/'])

/** The page a site's root addresses. Mirrors `normalizePath` in the frontend's page store. */
const HOME_PATH = 'home'

/** The element the injected copy is wrapped in. `frontend/index.html` styles it; `main.js` removes it. */
const PRERENDER_ID = 'wiki-prerender'

/** What the shell is enriched with, before it is put into the document. */
interface ShellFragments {
  /** Replaces the shell's `<title>` and is appended to its `<head>`. */
  head: string
  /** Appended to the shell's `<body>`. Empty where there is no page body to show. */
  body: string
  /** 200, or 404 for a page path with nothing a reader without a session may read at it. */
  status: number
  /** The `X-Robots-Tag` to answer with, or null where a crawler's default is what the site wants. */
  robots: string | null
}

export interface AppShellDocument {
  html: string
  status: number
  robots: string | null
}

/**
 * Drop every enriched fragment set.
 *
 * Called wherever something that shapes a public document changes: a page (its title, its body, its
 * indexability, where it sits), a site's settings (its own title and description, whether it wants to
 * be indexed, how it brackets URLs by locale) or a group's rules (what the public may read at all).
 * The last of those is a permissions question rather than a freshness one, which is why it cannot be
 * left to the TTL — the same reasoning as `invalidateSitemaps`, and the same call sites.
 */
export function invalidateAppShellCache(): void {
  WIKI.cache.del(WIKI.cache.keys().filter((key) => key.startsWith(SHELL_CACHE_PREFIX)))
}

/**
 * Whether this request will boot the app, or is something that will only ever read the document.
 *
 * A verified API key counts as a session for this, as it does everywhere else: a caller holding one
 * has an identity, and enriching its document with the public's view of a page would be answering a
 * different question from the one it asked.
 */
function isAnonymous(req: FastifyRequest): boolean {
  return !req.session?.authenticated && !req.apiKey
}

/**
 * The cache identity of a document.
 *
 * The host is part of it because the document is: a canonical link and an unfurl card carry absolute
 * URLs, and those are built against the host the request arrived on (`originOf`). A site bound to the
 * catch-all `*` answers on any number of hostnames, so two requests for the same page are not
 * necessarily the same document. Hence also `SHELL_CACHE_MAX_ENTRIES`.
 */
function cacheKeyFor(origin: string, urlPath: string): string {
  return `${SHELL_CACHE_PREFIX}${origin}${urlPath}`
}

/**
 * What a site tells a crawler about a document it has already fetched, as an `X-Robots-Tag` value.
 *
 * The other half of the **General → SEO** settings, and the half that carries what robots.txt cannot:
 * that file can only say whether to CRAWL a path (see `controllers/rootFiles.ts`), while `noindex`
 * and `nofollow` are instructions about a document in hand. A search engine reads this header exactly
 * as it reads a `<meta name="robots">` tag, and — unlike a tag the frontend would set once it booted —
 * it is there for a crawler that does not run the page's JavaScript. It is the header and not a tag
 * for that reason, and it is only the header so that the two can never disagree.
 *
 * `noindex` is also the setting's only thorough form. `Disallow: /` keeps a crawler off the page, but
 * a page nobody fetched can still be listed from its inbound links alone; this is what says not to
 * list it.
 *
 * @param indexable False for a document there is no sense in listing whatever the site says: a page
 *   marked as not searchable, one with nothing public at it, and every URL that is not a page at all —
 *   the app's own screens, which are an interface and not content.
 *
 * @returns Null when the site wants both and the document allows it, which is every crawler's default
 *   anyway: no header says the same thing as `index, follow`, and a wiki that wants to be found should
 *   not have to repeat it on every response.
 */
function robotsTagFor(siteId: string | undefined, indexable: boolean): string | null {
  // -> A host matching no site at all is still handed the app shell, and is told not to index it:
  //    there is no site here whose settings could say otherwise
  const robots = siteId ? WIKI.sites[siteId]?.config?.robots : undefined
  const index = Boolean(robots?.index) && indexable
  const follow = Boolean(robots?.follow)
  if (index && follow) {
    return null
  }
  return `${index ? 'index' : 'noindex'}, ${follow ? 'follow' : 'nofollow'}`
}

/**
 * Which page a URL addresses, as the database holds it.
 *
 * The same reading the frontend router gives it, which is what keeps the injected document and the
 * app that replaces it about the same page: `splitLocalePath` takes off a locale prefix if the first
 * segment names one of the site's locales, and what is left is a page path. A path arriving without a
 * prefix is in the site's primary locale — the request hook in `index.ts` is what redirects one that
 * should have had a prefix, and it runs before this.
 */
function resolvePagePath(
  siteId: string | undefined,
  urlPath: string
): { locale: string; path: string; isRoot: boolean } {
  const locales = siteId ? WIKI.sites[siteId]?.config?.locales : undefined
  const split = splitLocalePath(urlPath, WIKI.models.locales.urlPrefixesFor(locales?.active))
  const below = split?.path ?? urlPath
  return {
    locale: split?.locale ?? locales?.primary ?? 'en',
    // -> The site root is the `home` page rather than an empty path, the same as everywhere else
    path: normalizePagePath(below) || HOME_PATH,
    isRoot: ROOT_PATHS.has(below)
  }
}

/**
 * The stored render with everything that would *run* taken out.
 *
 * A page whose author holds `write:scripts` or `write:styles` keeps its `<script>` and `<style>` in
 * the render, and the app runs them when it displays the page. The same markup sitting in the document
 * as the browser parses it would run them a second time, before the app exists and outside anything
 * that knows about the page — so what goes into the shell is the prose and nothing else. Inline
 * handlers, `<template>` and `<link>` go for the same reason.
 *
 * Not a security boundary, and not a second sanitizer: the render was sanitized at save time against
 * what its author was allowed to embed (`models/rendering.ts`), and this is that same markup with
 * less in it. What this prevents is one page being executed twice.
 */
function stripActiveMarkup(html: string): string {
  const $ = cheerio.load(html, null, false)
  $('script, style, link, template').remove()
  for (const el of $('*')) {
    // -> `$('*')` only ever yields elements, but its element type is the union every node could be
    for (const attr of Object.keys((el as { attribs?: Record<string, string> }).attribs ?? {})) {
      if (attr.toLowerCase().startsWith('on')) {
        $(el).removeAttr(attr)
      }
    }
  }
  return $.html()
}

/** One `<meta>`, or nothing at all for a value the site or the page has not filled in. */
function metaTag(kind: 'name' | 'property', key: string, value: string | null | undefined): string {
  return value ? `<meta ${kind}="${key}" content="${htmlEscape(value)}">` : ''
}

/**
 * The absolute URL of a page, which is what a canonical link and an unfurl card name it by.
 *
 * `urlFor` decides the path, the same as for every link the wiki makes of its own pages and for every
 * `<loc>` in the sitemap — so the two documents a crawler reads agree about where a page is, locale
 * prefix and all. A page path is held to `[a-zA-Z0-9-_/]` when it is saved, but a locale's short code
 * is an administrator's to alias, so the result is percent-encoded before it is escaped.
 */
function urlOf(origin: string, siteId: string, locale: string, path: string): string {
  return `${origin}${encodeURI(WIKI.models.pages.urlFor(siteId, locale, path))}`
}

/**
 * The head of a document describing one page.
 *
 * What a crawler and an unfurl card actually read, and all of it is a column: the title, the
 * description, when the page last changed, and the locales it exists in. `og:` and `twitter:` are
 * here because no chat client reads anything else — a link pasted into Slack or Discord is the most
 * common way a wiki page is shared, and it is the surface this was most visibly missing.
 *
 * The title is composed exactly as `MainLayout.vue` composes it, so the tab does not change under a
 * reader the moment the app boots.
 *
 * There is deliberately no `<meta name="robots">`: that is the `X-Robots-Tag` above, which reaches
 * the same clients and cannot fall out of step with itself.
 */
function headForPage(
  origin: string,
  siteId: string,
  siteConfig: any,
  page: PageDescription
): string {
  const siteTitle: string = siteConfig?.title || 'Wiki.js'
  const url = urlOf(origin, siteId, page.locale, page.path)
  const description = page.description || siteConfig?.description || ''
  // -> Only a logo an administrator actually put there: the route falls back to the Wiki.js mark for a
  //    site with none, and a card carrying that says less than a card carrying no image
  const image =
    siteConfig?.logoUrl || (siteConfig?.assets?.logo ? `${origin}/_site/current/logo` : '')

  return [
    `<title>${htmlEscape(`${page.title} - ${siteTitle}`)}</title>`,
    metaTag('name', 'description', description),
    `<link rel="canonical" href="${htmlEscape(url)}">`,
    ...page.alternates.map(
      (alt) =>
        `<link rel="alternate" hreflang="${htmlEscape(alt.locale)}" href="${htmlEscape(urlOf(origin, siteId, alt.locale, alt.path))}">`
    ),
    metaTag('property', 'og:type', 'article'),
    metaTag('property', 'og:site_name', siteTitle),
    metaTag('property', 'og:title', page.title),
    metaTag('property', 'og:description', description),
    metaTag('property', 'og:url', url),
    metaTag('property', 'og:image', image),
    metaTag(
      'property',
      'article:modified_time',
      page.updatedAt.toTemporalInstant().toString({
        smallestUnit: 'second'
      })
    ),
    metaTag('name', 'twitter:card', image ? 'summary' : null)
  ]
    .filter(Boolean)
    .join('\n    ')
}

/**
 * The head of a document that is not a page: the site itself, and nothing more specific.
 *
 * What a URL with no page at it gets, so that a 404 and a wiki whose home page has not been written
 * yet still carry the site's own name rather than `Wiki.js`.
 */
function headForSite(siteConfig: any): string {
  const siteTitle: string = siteConfig?.title || 'Wiki.js'
  return [
    `<title>${htmlEscape(siteTitle)}</title>`,
    metaTag('name', 'description', siteConfig?.description),
    metaTag('property', 'og:type', 'website'),
    metaTag('property', 'og:site_name', siteTitle),
    metaTag('property', 'og:title', siteTitle)
  ]
    .filter(Boolean)
    .join('\n    ')
}

/**
 * The page's own markup, for a client that will not run the app.
 *
 * Wrapped in one element with a known id, which is what lets both sides deal with it: the stylesheet
 * in `frontend/index.html` keeps it out of sight of anyone whose browser is about to draw the real
 * thing and shows it to anyone whose browser is not, and `main.js` takes it out of the document
 * before Vue mounts, so nothing the app does has to know it was ever there.
 *
 * The title is deliberately not repeated above the body as a heading. A page written the ordinary way
 * opens with its own `# Title`, so a synthesized one is the same words twice — and where a page has
 * no heading of its own, the title is still in `<title>` and `og:title`, which is where every client
 * that cares about it looks.
 */
function bodyForPage(page: PageDescription): string {
  if (!page.render) {
    return ''
  }
  return `<div id="${PRERENDER_ID}">${stripActiveMarkup(page.render)}</div>`
}

/**
 * The fragments for a client that will never run the app — a crawler, an unfurl card, a reader with
 * JavaScript off.
 *
 * The public's view of the page and nobody else's, which is what makes this the one that is cached
 * and handed on: it is the same document whoever fetched it. It is also the only kind that carries a
 * body and the only kind that ever answers 404.
 */
async function fragmentsForCrawler(
  req: FastifyRequest,
  siteId: string | undefined,
  urlPath: string
): Promise<ShellFragments> {
  const siteConfig = siteId ? WIKI.sites[siteId]?.config : undefined

  /*
    Everything that is not a page path is the app's own interface — `/_admin`, `/_profile`, `/_edit`,
    the search screen — and there is nothing in any of it for a search engine to list. Told so
    explicitly rather than left to a crawler's judgement, and given no description of its own: these
    screens have no content until the app has run, and a site that wants to be indexed should not have
    its admin area competing with its pages for the result.
  */
  if (!siteId || !isPageUrl(urlPath)) {
    return {
      head: headForSite(siteConfig),
      body: '',
      status: 200,
      robots: robotsTagFor(siteId, false)
    }
  }

  const { locale, path, isRoot } = resolvePagePath(siteId, urlPath)
  const page = await WIKI.models.pages.describePageForPublic(siteId, { locale, path })

  if (!page) {
    /*
      Nothing here that the public may read — no page, an unpublished one, or one the guests group's
      rules refuse. All three are one answer, and the answer is 404: the shell answering 200 for every
      path is what tells a crawler that a mistyped URL is a page, and a wiki can be enumerated
      indefinitely on the strength of it.

      The site root is the exception and always answers 200. There is something to show there whatever
      the database says — the welcome screen of a wiki whose home page has not been written yet, or a
      login form on a wiki that is not public at all — and a root that answered 404 would report a
      working instance as broken to every uptime check pointed at it.
    */
    return {
      head: headForSite(siteConfig),
      body: '',
      status: isRoot ? 200 : 404,
      robots: robotsTagFor(siteId, false)
    }
  }

  return {
    head: headForPage(originOf(req), siteId, siteConfig, page),
    body: bodyForPage(page),
    status: 200,
    robots: robotsTagFor(siteId, page.isIndexable)
  }
}

/**
 * The fragments for a browser that is about to boot the app.
 *
 * The head alone, describing the page as THIS requester may see it — an unpublished page included, a
 * page the public may not read included, and nothing they could not have opened themselves.
 * `describePageForRequest` makes exactly the cut the page route makes, so the title in the document
 * and the page the app then draws can never be about different things.
 *
 * It matters even though the app will set the title itself a moment later: the document's own title is
 * what the tab reads while the bundle loads, what a bookmark or a history entry made before it
 * finishes boot keeps for ever, and what a `Ctrl+D` on a slow connection saves. `Wiki.js` for every
 * page of every wiki is simply wrong there.
 *
 * Three things it deliberately does not do. No body: the app is about to draw the page properly, so a
 * copy is bytes on every hard navigation for content the browser will discard. No 404: the difference
 * between a path with no page and one this reader may create is the app's own flow to present, and it
 * needs the document to say 200. And no page-specific `noindex` — nothing will index a document
 * fetched with a session, and a header invented here would be describing that session rather than the
 * wiki.
 *
 * Never cached. The answer depends on who asked, which is exactly what the cached public document may
 * not do; one read of one row per hard navigation is the price, and the app is about to fetch the same
 * page over the API regardless.
 */
async function fragmentsForBrowser(
  req: FastifyRequest,
  siteId: string | undefined,
  urlPath: string
): Promise<ShellFragments> {
  const siteConfig = siteId ? WIKI.sites[siteId]?.config : undefined
  const robots = robotsTagFor(siteId, true)

  if (!siteId || !isPageUrl(urlPath)) {
    return { head: headForSite(siteConfig), body: '', status: 200, robots }
  }

  const { locale, path } = resolvePagePath(siteId, urlPath)
  const page = await WIKI.models.pages.describePageForRequest(siteId, { locale, path }, req)

  return {
    head: page ? headForPage(originOf(req), siteId, siteConfig, page) : headForSite(siteConfig),
    body: '',
    status: 200,
    robots
  }
}

/**
 * The document to answer a request for the app shell with.
 *
 * Every request gets a head describing the page at its URL; which page that is, and what else travels
 * with it, is what `fragmentsForCrawler` and `fragmentsForBrowser` differ about.
 *
 * Only the public half is cached, and the shell is never cached: the shell is re-read per request so
 * that `npm run build` in `frontend/` takes effect immediately, which a cached whole document would
 * have delayed by the TTL, and the two string insertions that combine them are nothing next to a
 * database read. Both insertions use a replacer function rather than a replacement string — a page
 * containing `$&` would otherwise rewrite itself as it was inserted.
 *
 * @param shell The compiled `assets/index.html`, as read for this request
 */
export async function renderAppShell(
  req: FastifyRequest,
  siteId: string | undefined,
  shell: string
): Promise<AppShellDocument> {
  const urlPath = req.raw.url!.split('?')[0]!
  const fragments = isAnonymous(req)
    ? await publicFragments(req, siteId, urlPath)
    : await fragmentsForBrowser(req, siteId, urlPath)

  /*
    The head replaces the shell's own `<title>` where there is one and is appended to its `<head>`
    where there is not, so that a shell built without one is enriched rather than silently skipped.
  */
  const withoutTitle = shell.replace(/[ \t]*<title>[\s\S]*?<\/title>\n?/i, '')
  const html = withoutTitle
    .replace('</head>', () => `  ${fragments.head}\n  </head>`)
    .replace('</body>', () => `${fragments.body}</body>`)

  return { html, status: fragments.status, robots: fragments.robots }
}

/** The cached half: one URL's public fragments, keeping the namespace under its ceiling. */
async function publicFragments(
  req: FastifyRequest,
  siteId: string | undefined,
  urlPath: string
): Promise<ShellFragments> {
  const key = cacheKeyFor(originOf(req), urlPath)
  const cached = WIKI.cache.get<ShellFragments>(key)
  if (cached) {
    return cached
  }
  const fragments = await fragmentsForCrawler(req, siteId, urlPath)
  const held = WIKI.cache.keys().filter((k) => k.startsWith(SHELL_CACHE_PREFIX)).length
  if (held >= SHELL_CACHE_MAX_ENTRIES) {
    invalidateAppShellCache()
  }
  WIKI.cache.set(key, fragments, SHELL_CACHE_TTL)
  return fragments
}
