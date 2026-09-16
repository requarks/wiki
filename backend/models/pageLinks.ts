import { and, eq, ne, or, sql } from 'drizzle-orm'
import { pageLinks as pageLinksTable, pages as pagesTable } from '../db/schema.ts'
import { linksFromRender, resolveLink } from '../helpers/pageLinks.ts'
import type { LinkSource, PageLinkKind, ResolvedLink } from '../helpers/pageLinks.ts'

/**
 * Page links model
 *
 * What every page points at, kept in step with the page.
 *
 * The rows are derived, exactly as `toc` and `searchContent` are, and from the same thing: the stored
 * render. There is no markdown parser on this side — a page's HTML is produced in the editor's
 * browser and sent up — so the render is the only settled form of a page the server has, and
 * `rendering.linksFromRender` is what reads the anchors out of it. Two link sources are not in the
 * render at all and are collected by the pages model instead: a redirection's target lives in its
 * content, and a page's relations are stored as their own column.
 *
 * Nothing here decides what a link MEANS — `helpers/pageLinks.ts` does that, and is where the rules
 * for reading a page URL live. This model is the storage half: swap a page's rows, and answer the
 * three questions the table exists for.
 */

/**
 * The editor whose content IS a link.
 *
 * Spelled out here rather than imported from `models/pages.ts`, which pulls in the storage, search and
 * tree models behind it — this model is one of the few a worker thread loads, and the rebuild utility
 * runs in one. See `worker.ts` on what an import costs there.
 */
const REDIRECT_EDITOR = 'redirect'

/** The columns of a page that say what it links to. */
export interface PageLinkSource {
  id: string
  siteId: string
  locale: string
  path: string
  editor: string
  content: string | null
  relations: unknown
  render: string | null
}

/** A link on a page, with the page it was found on. */
export interface PageLinkRow {
  id: string
  pageId: string
  kind: PageLinkKind
  href: string
  targetSiteId: string
  targetLocale: string | null
  targetPath: string | null
  targetRef: string | null
}

/** One page linking to another, as a "what links here" list shows it. */
export interface Backlink {
  pageId: string
  siteId: string
  locale: string
  path: string
  title: string
  description: string | null
  /** The page's own icon, as an Iconify reference. Empty where it has none. */
  icon: string | null
  /** How the link is written, since the same page may point at a target more than one way. */
  href: string
  kind: PageLinkKind
  tags: string[]
  publishState: string
  /** Where that page is, as a path on ITS OWN site — locale prefix included only where that site
      brackets its URLs by one. */
  url: string
  /**
   * The host that site answers on, so a reader looking at one site can still follow a link back to a
   * page on another. Null for the catch-all site, which has no host of its own to name.
   */
  hostname: string | null
}

/** A link on a page, and whether anything is actually at the other end. */
export interface OutboundLink extends PageLinkRow {
  /** The page it resolves to, or null when nothing is there — a red link. */
  targetPageId: string | null
  targetTitle: string | null
  /*
    Where the resolved page actually sits, and what it is tagged with, rather than what the link said
    about it. Both are here so the caller can ask whether this reader may know the page exists: an
    alias or an id link carries no address at all, and a page rule can be written against tags.
  */
  targetPageLocale: string | null
  targetPagePath: string | null
  targetPageTags: string[] | null
}

/** Where a page sits, which is how a link addresses it. */
export interface LinkTarget {
  siteId: string
  locale: string
  path: string
}

class PageLinks {
  /**
   * Whether this site shows what links to a page.
   *
   * **Display only.** Off, the Links tab is not drawn and the route behind it answers 404 — and every
   * save still records what it links to, exactly as before. That is the whole point of putting the
   * switch here rather than around `refreshForPage`: a site that turns this off for a year and back
   * on again has a complete answer waiting, where one that stopped writing the table would have a
   * year of pages to rebuild before the tab said anything true.
   *
   * `!== false` rather than a truth test, so a site whose config blob has never been written with the
   * key reads as on — which is what the default in `sites.createSite` says it is.
   */
  isAllowed(siteId: string | undefined): boolean {
    return siteId ? WIKI.sites[siteId]?.config?.features?.backlinks !== false : false
  }

  /**
   * Work out everything a page points at, and store it.
   *
   * Three sources, because a link is not only a thing in an article:
   *
   *  - **The render**, which is where an author's own links are, and where nearly all of them are.
   *  - **A redirection's target**, which is not in a render at all — a redirect page has no body, it
   *    has a destination, and it is the strongest link in the wiki: a reader following one never sees
   *    that it broke, they just land nowhere.
   *  - **The page's relations**, the sidebar links its properties dialog collects. Stored as their own
   *    column, written by the same link picker that writes one into content, and just as breakable.
   *
   * @param renderHrefs What `postProcess` already read out of the render it just produced, for a save
   *                    that is storing one. Absent, the stored render is parsed instead — which is the
   *                    case for a page that MOVED: nothing about it changed, but every relative link
   *                    on it now resolves somewhere else.
   */
  async refreshForPage(page: PageLinkSource, renderHrefs?: string[]): Promise<void> {
    const hrefs = renderHrefs ?? linksFromRender(page.render)

    if (page.editor === REDIRECT_EDITOR && page.content) {
      try {
        const redirect = JSON.parse(page.content)
        // -> `kind: 'url'` is a destination off this wiki, which `resolveLink` would discard anyway.
        //    Passed through regardless, so that the one place deciding what is a link stays the one
        //    place deciding it
        if (typeof redirect?.target === 'string') {
          hrefs.push(redirect.target)
        }
      } catch {
        // -> A redirection whose content will not parse points nowhere, which is no links rather than
        //    a failed save. `normalizeRedirectContent` is what stops one being written in the first
        //    place
      }
    }

    for (const relation of (Array.isArray(page.relations) ? page.relations : []) as any[]) {
      if (typeof relation?.target === 'string') {
        hrefs.push(relation.target)
      }
    }

    await this.replaceFor(
      { pageId: page.id, siteId: page.siteId, locale: page.locale, path: page.path },
      hrefs
    )
  }

  /**
   * The same, for a caller holding an id rather than a row.
   *
   * What everything but a create reaches for: a save, a move, a folder rename and the rebuild utility
   * all need the page as it stands AFTER their write, so reading it back is the point rather than an
   * overhead.
   */
  async refreshById(siteId: string, pageId: string, renderHrefs?: string[]): Promise<void> {
    const rows = await WIKI.db
      .select({
        id: pagesTable.id,
        siteId: pagesTable.siteId,
        locale: pagesTable.locale,
        path: pagesTable.path,
        editor: pagesTable.editor,
        content: pagesTable.content,
        relations: pagesTable.relations,
        render: pagesTable.render
      })
      .from(pagesTable)
      .where(and(eq(pagesTable.id, pageId), eq(pagesTable.siteId, siteId)))
      .limit(1)

    // -> Gone while the save that asked for this was in flight. Its rows went with it
    if (rows[0]) {
      await this.refreshForPage(rows[0] as PageLinkSource, renderHrefs)
    }
  }

  /**
   * Replace every link recorded for a page.
   *
   * Wholesale rather than differential: a save rewrites the page, and working out which links
   * survived it costs more than the handful of rows it would save. In one transaction so that a page
   * is never momentarily linkless — the backlinks of everything it points at would flicker.
   *
   * Resolution happens here rather than at extraction time because it needs the page's own address:
   * `../two` means a different page depending on where the page holding it sits, which is also why
   * this has to run again when a page MOVES even though nothing about its content changed.
   *
   * Unresolvable hrefs are dropped silently — an external link, a `mailto:`, a bare fragment, an
   * admin path. See `resolveLink` for the whole list; none of them is a link this can be asked a
   * question about.
   *
   * @param source The page the links were found on
   * @param hrefs Every href the page carries, in any order and with repeats
   */
  async replaceFor(source: LinkSource & { pageId: string }, hrefs: string[]): Promise<void> {
    const resolved = new Map<string, ResolvedLink>()
    for (const href of hrefs) {
      const link = resolveLink(href, source)
      if (link) {
        // -> One row per spelling, so the same href written twice on a page is one link. Keyed on the
        //    href as written, which is what the unique index holds
        resolved.set(link.href, link)
      }
    }

    await WIKI.db.transaction(async (trx: any) => {
      await trx.delete(pageLinksTable).where(eq(pageLinksTable.pageId, source.pageId))
      if (resolved.size < 1) {
        return
      }
      await trx.insert(pageLinksTable).values(
        [...resolved.values()].map((link) => ({
          pageId: source.pageId,
          siteId: source.siteId,
          kind: link.kind,
          href: link.href,
          targetSiteId: link.targetSiteId,
          targetLocale: link.targetLocale,
          targetPath: link.targetPath,
          targetRef: link.targetRef
        }))
      )
    })
  }

  /** Forget everything a page pointed at, for a page that is going. */
  async removeFor(pageId: string): Promise<void> {
    await WIKI.db.delete(pageLinksTable).where(eq(pageLinksTable.pageId, pageId))
  }

  /**
   * Every page linking to a target, as "what links here" asks it.
   *
   * Addressed by locale and path rather than by page id, and deliberately: a link says where it
   * points, so the pages pointing at a page that has moved are still pointing at where it WAS. Asking
   * by address is what lets a move ask about the path it is leaving, which is the only time that
   * question has an answer.
   *
   * The two id-addressed kinds are folded in by page id, since those survive a move by design and
   * would otherwise be missing from the one list anybody reads.
   *
   * Nothing here filters by what the caller may read: a backlink names a page, and which of them this
   * reader is allowed to know about is a page rule the route resolves — see `api/pages.ts`.
   */
  async backlinksFor(
    target: LinkTarget,
    { pageId, alias }: { pageId?: string; alias?: string | null } = {}
  ): Promise<Backlink[]> {
    const addressedByPath = and(
      eq(pageLinksTable.kind, 'page'),
      eq(pageLinksTable.targetLocale, target.locale),
      eq(pageLinksTable.targetPath, target.path)
    )
    const addressedById = pageId
      ? and(eq(pageLinksTable.kind, 'pageId'), eq(pageLinksTable.targetRef, pageId))
      : undefined
    const addressedByAlias = alias
      ? and(eq(pageLinksTable.kind, 'alias'), eq(pageLinksTable.targetRef, alias))
      : undefined

    const rows = await WIKI.db
      .select({
        pageId: pageLinksTable.pageId,
        href: pageLinksTable.href,
        kind: pageLinksTable.kind,
        siteId: pagesTable.siteId,
        locale: pagesTable.locale,
        path: pagesTable.path,
        title: pagesTable.title,
        description: pagesTable.description,
        icon: pagesTable.icon,
        tags: pagesTable.tags,
        publishState: pagesTable.publishState
      })
      .from(pageLinksTable)
      .innerJoin(pagesTable, eq(pagesTable.id, pageLinksTable.pageId))
      .where(
        and(
          eq(pageLinksTable.targetSiteId, target.siteId),
          // -> A page linking to itself is not a backlink, it is a page mentioning where it already is
          ...(pageId ? [ne(pageLinksTable.pageId, pageId)] : []),
          or(addressedByPath, addressedById, addressedByAlias)
        )
      )
      .orderBy(pagesTable.locale, pagesTable.path)

    return rows.map((row: any) => ({
      ...row,
      tags: row.tags ?? [],
      // -> A backlink may be written on another site of this instance, and a bare path would resolve
      //    against the host the reader is already on. Same pair as `getRecentlyEdited`, for the same
      //    reason: `*` is the catch-all rather than a host, and a link to it is wherever you are
      url: WIKI.models.pages.urlFor(row.siteId, row.locale, row.path),
      hostname:
        WIKI.sites[row.siteId]?.hostname && WIKI.sites[row.siteId].hostname !== '*'
          ? WIKI.sites[row.siteId].hostname
          : null
    })) as Backlink[]
  }

  /**
   * Every link written on a page, with whether the far end exists.
   *
   * The join is what answers the red-link question, and it is a join rather than a stored flag for
   * the reason the whole table is addressed by path: a page created at a path somebody had already
   * linked to makes that link good, without anything having to notice.
   *
   * Assets are left unresolved here — they are recorded so that a moved file can be traced back to
   * what pointed at it, and answering whether one exists means a tree lookup per link.
   */
  async outboundFor(pageId: string): Promise<OutboundLink[]> {
    const rows = await WIKI.db
      .select({
        id: pageLinksTable.id,
        pageId: pageLinksTable.pageId,
        kind: pageLinksTable.kind,
        href: pageLinksTable.href,
        targetSiteId: pageLinksTable.targetSiteId,
        targetLocale: pageLinksTable.targetLocale,
        targetPath: pageLinksTable.targetPath,
        targetRef: pageLinksTable.targetRef,
        targetPageId: pagesTable.id,
        targetTitle: pagesTable.title,
        targetPageLocale: pagesTable.locale,
        targetPagePath: pagesTable.path,
        targetPageTags: pagesTable.tags
      })
      .from(pageLinksTable)
      .leftJoin(
        pagesTable,
        or(
          and(
            eq(pageLinksTable.kind, 'page'),
            eq(pagesTable.siteId, pageLinksTable.targetSiteId),
            eq(pagesTable.locale, pageLinksTable.targetLocale),
            eq(pagesTable.path, pageLinksTable.targetPath)
          ),
          and(
            eq(pageLinksTable.kind, 'pageId'),
            sql`${pagesTable.id}::text = ${pageLinksTable.targetRef}`
          ),
          and(
            eq(pageLinksTable.kind, 'alias'),
            eq(pagesTable.siteId, pageLinksTable.targetSiteId),
            eq(pagesTable.alias, pageLinksTable.targetRef)
          )
        )
      )
      .where(eq(pageLinksTable.pageId, pageId))
      .orderBy(pageLinksTable.href)

    return rows as OutboundLink[]
  }

  /**
   * The pages that will be left pointing at nothing if these targets move or go.
   *
   * The bulk form of `backlinksFor`, for a folder rename — which moves every page under it at once —
   * and for anything else that has to warn about a change before making it. One query for the lot,
   * since a rename can move hundreds of pages and asking per page would be hundreds of round trips.
   *
   * Only path-addressed links: the id and alias kinds survive a move, so they are not affected by
   * one and do not belong in a list of what it breaks.
   *
   * @returns The id of every page holding such a link, without repeats
   */
  async dependentsOf(
    siteId: string,
    targets: { locale: string; path: string }[]
  ): Promise<string[]> {
    if (targets.length < 1) {
      return []
    }
    const rows = await WIKI.db
      .selectDistinct({ pageId: pageLinksTable.pageId })
      .from(pageLinksTable)
      .where(
        and(
          eq(pageLinksTable.targetSiteId, siteId),
          eq(pageLinksTable.kind, 'page'),
          or(
            ...targets.map((target) =>
              and(
                eq(pageLinksTable.targetLocale, target.locale),
                eq(pageLinksTable.targetPath, target.path)
              )
            )
          )
        )
      )

    return rows.map((row: any) => row.pageId as string)
  }
}

export const pageLinks = new PageLinks()
