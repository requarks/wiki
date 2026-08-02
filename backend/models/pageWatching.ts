import { and, desc, eq } from 'drizzle-orm'
import { pageWatching as watchingTable, pages as pagesTable } from '../db/schema.ts'

/** A watched page, as the inbox lists it. */
export interface WatchedPage {
  pageId: string
  path: string
  locale: string
  title: string
  description: string | null
  icon: string | null
  /** When the page itself last changed, which is what a watcher is watching FOR. */
  updatedAt: Date
  /** When this person started watching, i.e. how long they have been asking to be told. */
  watchedAt: Date
}

/**
 * Page watching model
 *
 * Who has asked to be told about which pages. Nothing is sent yet — notifications are not built — so
 * this is the list and nothing more: the bell on a page reads it, the inbox lists it, and whatever
 * delivers the news later has one place to ask who wants it.
 */
class PageWatching {
  /**
   * Whether this user is watching this page.
   *
   * Answered for the page view, which asks about every page it draws, so it is a single indexed lookup
   * on the pair — and not asked at all for a guest, who cannot watch anything.
   */
  async isWatching(pageId: string, userId: string | null): Promise<boolean> {
    if (!userId) {
      return false
    }
    const rows = await WIKI.db
      .select({ id: watchingTable.id })
      .from(watchingTable)
      .where(and(eq(watchingTable.pageId, pageId), eq(watchingTable.userId, userId)))
      .limit(1)
    return rows.length > 0
  }

  /**
   * Start watching a page.
   *
   * Idempotent: watching a page one is already watching is what the reader asked for, and the unique
   * index turns the second row into nothing rather than into an error.
   */
  async watch({
    siteId,
    pageId,
    userId
  }: {
    siteId: string
    pageId: string
    userId: string
  }): Promise<void> {
    await WIKI.db
      .insert(watchingTable)
      .values({ siteId, pageId, userId })
      .onConflictDoNothing({ target: [watchingTable.pageId, watchingTable.userId] })
  }

  /**
   * Stop watching a page. Also idempotent, for the same reason: the outcome asked for is that no row
   * exists, and it does not.
   */
  async unwatch({ pageId, userId }: { pageId: string; userId: string }): Promise<void> {
    await WIKI.db
      .delete(watchingTable)
      .where(and(eq(watchingTable.pageId, pageId), eq(watchingTable.userId, userId)))
  }

  /**
   * The pages this user watches on a site, most recently watched first.
   *
   * Joined to the pages rather than storing a copy of the title and the path, so a page that is
   * renamed or moved is listed where it is now — which is the point of watching it. A deleted page
   * takes its rows with it through the foreign key, so nothing here can point at one that is gone.
   */
  async listForUser(siteId: string, userId: string): Promise<WatchedPage[]> {
    const rows = await WIKI.db
      .select({
        pageId: pagesTable.id,
        path: pagesTable.path,
        locale: pagesTable.locale,
        title: pagesTable.title,
        description: pagesTable.description,
        icon: pagesTable.icon,
        updatedAt: pagesTable.updatedAt,
        watchedAt: watchingTable.createdAt
      })
      .from(watchingTable)
      .innerJoin(pagesTable, eq(pagesTable.id, watchingTable.pageId))
      .where(and(eq(watchingTable.userId, userId), eq(watchingTable.siteId, siteId)))
      .orderBy(desc(watchingTable.createdAt))
    return rows as WatchedPage[]
  }
}

export const pageWatching = new PageWatching()
