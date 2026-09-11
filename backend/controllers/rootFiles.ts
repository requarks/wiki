import { chunk } from 'es-toolkit/array'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { SitemapPage } from '../models/pages.ts'

/**
 * The sitemap protocol's own ceiling: 50,000 URLs, and 50MB uncompressed, per file. Past it the
 * document served is a sitemap index naming numbered parts of this size instead.
 */
const MAX_URLS_PER_FILE = 50000

/**
 * How long a crawler — or anything caching in front of this — may hold one of these files.
 *
 * `public` whoever asked: neither document varies by requester. The sitemap is `listForSitemap`'s
 * answer, which is the guests group's view and nobody else's, and robots.txt is a site setting — so a
 * shared cache has nothing to leak from one reader to another. Ten minutes because the alternative to
 * a slightly stale sitemap is re-reading every page of a wiki for a file a crawler fetches a few
 * times a day.
 */
const ROOT_FILE_CACHE = 'public, max-age=600'

/** Everything written into the document goes through here, including anything that came off a header. */
function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

/**
 * The origin a `<loc>` — or robots.txt's `Sitemap:` line — is written against.
 *
 * The requester's own, and deliberately not the site's configured hostname: a sitemap may only list
 * URLs on the host it was itself fetched from — a crawler discards the rest as a cross-submission —
 * so the host in the request IS the answer, whether the site is bound to it or is the catch-all `*`.
 * It comes off a header and is therefore whatever the client said, which is why it is escaped before
 * it reaches the XML. It cannot carry a line break into robots.txt: a header value holding one is
 * rejected by the HTTP parser long before this.
 */
function originOf(req: FastifyRequest): string {
  return `${req.protocol}://${req.host}`
}

/**
 * Where a page is, absolute and ready to be written into an element.
 *
 * `urlFor` is what decides the path, the same as for every link the wiki makes of its own pages, so
 * the locale prefix is bracketed exactly where that site's settings put one. A page path is held to
 * `[a-zA-Z0-9-_/]` when it is saved, but a locale's short code is an administrator's to alias, so the
 * result is percent-encoded before it is escaped.
 */
function locOf(origin: string, siteId: string, page: SitemapPage): string {
  return xmlEscape(
    `${origin}${encodeURI(WIKI.models.pages.urlFor(siteId, page.locale, page.path))}`
  )
}

/** W3C datetime, which is what `<lastmod>` takes. Seconds: a crawler has no use for the nanoseconds. */
function lastmodOf(date: Date): string {
  return date.toTemporalInstant().toString({ smallestUnit: 'second' })
}

/**
 * The translations of each page, keyed by locale group.
 *
 * Built over the WHOLE list rather than the part being rendered, so that a page whose other languages
 * fell into a different numbered file still names all of them. A page with no counterparts has a null
 * group and is absent from here — nulls are distinct, so they would otherwise all be one group.
 */
function localeGroupsOf(pages: SitemapPage[]): Map<string, SitemapPage[]> {
  const groups = new Map<string, SitemapPage[]>()
  for (const page of pages) {
    if (!page.localeGroupId) {
      continue
    }
    const group = groups.get(page.localeGroupId)
    if (group) {
      group.push(page)
    } else {
      groups.set(page.localeGroupId, [page])
    }
  }
  return groups
}

/**
 * One file of page URLs.
 *
 * `changefreq` and `priority` are deliberately absent: no search engine has read either for years,
 * and the wiki has nothing honest to put in them — every page would claim the same numbers.
 *
 * What is here instead is `xhtml:link`, one per language a page exists in, which is how a crawler is
 * told that two paths are the same page rather than duplicates of each other. Emitted only where a
 * page actually has counterparts, and including the page itself, which is what the annotation calls
 * for. Only counterparts that are in this document at all: a translation the guests group may not
 * read is not an alternate a crawler should be sent to.
 */
function renderUrlset(
  origin: string,
  siteId: string,
  pages: SitemapPage[],
  all: SitemapPage[]
): string {
  const groups = localeGroupsOf(all)
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
  ]
  for (const page of pages) {
    lines.push('  <url>')
    lines.push(`    <loc>${locOf(origin, siteId, page)}</loc>`)
    lines.push(`    <lastmod>${lastmodOf(page.updatedAt)}</lastmod>`)
    const alternates = page.localeGroupId ? (groups.get(page.localeGroupId) ?? []) : []
    if (alternates.length > 1) {
      for (const alternate of alternates) {
        lines.push(
          `    <xhtml:link rel="alternate" hreflang="${xmlEscape(alternate.locale)}" href="${locOf(origin, siteId, alternate)}"/>`
        )
      }
    }
    lines.push('  </url>')
  }
  lines.push('</urlset>')
  return `${lines.join('\n')}\n`
}

/**
 * The index served in place of the list once it no longer fits in one file.
 *
 * The parts are `?p=N` on this same path rather than files of their own, because a sitemap may only
 * list URLs at or below its own directory — a part under `/_sitemap/` could name nothing outside it —
 * and because the reserved root files a crawler may ask for are a fixed set that no numbered name
 * could join. A query string is a URL like any other to a crawler.
 */
function renderIndex(origin: string, parts: SitemapPage[][]): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
  ]
  parts.forEach((pages, index) => {
    const newest = pages.reduce<Date | null>(
      (latest, page) => (!latest || page.updatedAt > latest ? page.updatedAt : latest),
      null
    )
    lines.push('  <sitemap>')
    lines.push(`    <loc>${xmlEscape(`${origin}/sitemap.xml?p=${index + 1}`)}</loc>`)
    if (newest) {
      lines.push(`    <lastmod>${lastmodOf(newest)}</lastmod>`)
    }
    lines.push('  </sitemap>')
  })
  lines.push('</sitemapindex>')
  return `${lines.join('\n')}\n`
}

function sendXml(reply: FastifyReply, body: string) {
  return reply
    .header('Cache-Control', ROOT_FILE_CACHE)
    .type('application/xml; charset=utf-8')
    .send(body)
}

/**
 * Root file routes: `robots.txt` and `sitemap.xml`.
 *
 * The two files a crawler asks for at the root by convention rather than because the wiki has a page
 * there — which is why they are registered at the root rather than under one of the server's own
 * prefixes, and why `RESERVED_ROOT_FILES` holds both names: without that, the SEO hook would treat
 * `/sitemap.xml` as a page path and send a crawler off to the site's locale prefix, and `/robots.txt`
 * would be redirected to the page `robots`, `txt` being a page extension on a default site.
 * (`favicon.ico` is the third such name and is served by `@fastify/favicon`.)
 *
 * Both are public, both answer for whichever site the request's host resolves to, and both are driven
 * by that site's own settings in the admin area's **General → SEO** card.
 */
async function routes(app: FastifyInstance) {
  /**
   * robots.txt
   *
   * Two of the three settings on that card are about crawlers, and robots.txt can carry exactly one
   * of them:
   *
   * - **Allow Indexing** off becomes `Disallow: /`, which is as close as this file gets. Worth being
   *   clear that it is not the same instruction: `Disallow` says do not CRAWL, `noindex` says do not
   *   INDEX, and a page that is never crawled can still be listed from its inbound links alone. The
   *   thorough form of the setting is the `X-Robots-Tag` on every HTML response — `robotsTagFor` in
   *   `index.ts` — and this line is the coarse one that keeps a crawler off the wiki to begin with.
   * - **Allow Follow** has no expression here at all: `nofollow` is a directive about a document a
   *   crawler is holding, and robots.txt has no concept of one. That toggle is honoured by the same
   *   header, and this route does not pretend to carry it.
   * - **Allow Sitemap** adds the `Sitemap:` line, which is how a crawler that was given nothing but a
   *   hostname finds the sitemap at all. Omitted when indexing is off, since pointing a crawler at an
   *   index of pages it has just been told not to crawl says nothing coherent.
   *
   * Nothing per-page is ever written here — not the pages the guests group may not read, and not the
   * ones marked out of search results. robots.txt is world-readable, so a `Disallow` naming a path is
   * a published list of what a wiki considers worth hiding. What keeps those out of a crawler's way is
   * that they are absent from the sitemap and refused when asked for.
   *
   * Served whatever the settings say — there is no toggle for having a robots.txt, because a site
   * always has an answer to the question it asks. Only a host that resolves to no site at all 404s.
   */
  app.get('/robots.txt', async (req, reply) => {
    const site = await WIKI.models.sites.getSiteByHostname({ hostname: req.hostname })
    if (!site) {
      return reply.notFound()
    }

    const lines = ['User-agent: *']
    if (site.config?.robots?.index) {
      lines.push('Allow: /')
      if (site.config.sitemap) {
        lines.push('', `Sitemap: ${originOf(req)}/sitemap.xml`)
      }
    } else {
      lines.push('Disallow: /')
    }

    return reply
      .header('Cache-Control', ROOT_FILE_CACHE)
      .type('text/plain; charset=utf-8')
      .send(`${lines.join('\n')}\n`)
  })

  /**
   * sitemap.xml
   *
   * Off for a site whose **Allow Sitemap** is unticked, on for a new one.
   */
  app.get<{ Querystring: { p?: string } }>('/sitemap.xml', async (req, reply) => {
    const site = await WIKI.models.sites.getSiteByHostname({ hostname: req.hostname })
    if (!site?.config?.sitemap) {
      // -> A site with the setting off has no sitemap rather than an empty one, and 404 is what tells
      //    a crawler to stop asking for it
      return reply.notFound()
    }

    const pages = await WIKI.models.pages.listForSitemap(site.id)
    const origin = originOf(req)
    // -> A site with nothing a guest may read still answers, with an empty list: it is the truthful
    //    answer, and a 404 would read as the feature being broken rather than as the wiki being shut
    const parts = pages.length > 0 ? chunk(pages, MAX_URLS_PER_FILE) : [[]]

    if (req.query.p === undefined) {
      return sendXml(
        reply,
        parts.length > 1
          ? renderIndex(origin, parts)
          : renderUrlset(origin, site.id, parts[0]!, pages)
      )
    }

    const part = Number.parseInt(req.query.p, 10)
    if (!Number.isInteger(part) || part < 1 || part > parts.length) {
      return reply.notFound()
    }
    return sendXml(reply, renderUrlset(origin, site.id, parts[part - 1]!, pages))
  })
}

export default routes
