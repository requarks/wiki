import { and, eq, exists, inArray, ne, not, sql } from 'drizzle-orm'
import { pageRatings as ratingsTable, pages as pagesTable } from '../db/schema.ts'

/** The two scales a site can rate its pages on. `off` is the absence of one. */
export const RATING_MODES = ['thumbs', 'stars'] as const
export type RatingMode = (typeof RATING_MODES)[number]

/** The totals of one scale, as cached on the page. */
interface RatingTotals {
  count: number
  sum: number
  up: number
  down: number
}

/** `pages.ratings`: the totals per scale, absent for a scale nobody has rated the page on. */
export type PageRatingsCache = Partial<Record<RatingMode, RatingTotals>>

/** How a page has been rated, under the mode in force. */
export interface RatingSummary {
  mode: RatingMode
  /** How many readers have rated it. */
  count: number
  /** Mean of the ratings, 1 to 5 for stars and -1 to 1 for thumbs. 0 when nobody has rated it. */
  average: number
  /** Thumbs up. Always 0 under stars. */
  up: number
  /** Thumbs down. Always 0 under stars. */
  down: number
}

/**
 * Page ratings model
 *
 * One rating per reader per page, on whichever scale the site uses — see the table's comment in
 * `db/schema.ts`. Who may rate is the route's question (a logged in reader who may read the page);
 * everything here is about the scale and the totals.
 *
 * **The totals are cached on the page**, in `pages.ratings`, and a page view reads them from there:
 * pages are read far more often than they are rated, so the aggregate is worked out on the write.
 * Every scale is kept, so switching the site between thumbs and stars and back finds the totals where
 * they were.
 */
class PageRatings {
  /**
   * The scale this site rates on, or null when ratings are off for it.
   *
   * `features.ratingsMode` under General → Features. A page's own `allowRatings` is the other half,
   * and is the caller's to check, since it is a property of the page in hand.
   */
  modeFor(siteId: string): RatingMode | null {
    const mode = WIKI.sites[siteId]?.config?.features?.ratingsMode
    return (RATING_MODES as readonly string[]).includes(mode) ? mode : null
  }

  /** Whether `value` is a rating the scale accepts: ±1 for thumbs, a whole 1 to 5 for stars. */
  isValid(mode: RatingMode, value: number): boolean {
    if (!Number.isInteger(value)) {
      return false
    }
    return mode === 'thumbs' ? value === 1 || value === -1 : value >= 1 && value <= 5
  }

  /** How a page has been rated under `mode`, from the totals cached on it. No query. */
  summaryFromCache(cache: PageRatingsCache | null | undefined, mode: RatingMode): RatingSummary {
    const totals = cache?.[mode]
    const count = totals?.count ?? 0
    return {
      mode,
      count,
      average: count > 0 ? Math.round(((totals?.sum ?? 0) / count) * 100) / 100 : 0,
      up: mode === 'thumbs' ? (totals?.up ?? 0) : 0,
      down: mode === 'thumbs' ? (totals?.down ?? 0) : 0
    }
  }

  /**
   * This reader's own rating of a page under `mode`, or 0 for none.
   *
   * The one part of a page view's rating that cannot come off the page, being the reader's own: a
   * single lookup on the primary key, and none for a guest. A rating given under the other scale
   * reads as none, since it cannot be drawn on this one and rating again replaces it.
   */
  async valueFor(pageId: string, userId: string | null, mode: RatingMode): Promise<number> {
    if (!userId) {
      return 0
    }
    const [row] = await WIKI.db
      .select({ value: ratingsTable.value })
      .from(ratingsTable)
      .where(
        and(
          eq(ratingsTable.pageId, pageId),
          eq(ratingsTable.userId, userId),
          eq(ratingsTable.kind, mode)
        )
      )
    return row?.value ?? 0
  }

  /**
   * Rate a page, replacing whatever this reader had given it before, on either scale.
   *
   * @returns The page's totals as they stand after the rating.
   */
  async rate({
    pageId,
    userId,
    mode,
    value
  }: {
    pageId: string
    userId: string
    mode: RatingMode
    value: number
  }): Promise<PageRatingsCache> {
    return this.#changeAndRecount(pageId, (tx) =>
      tx
        .insert(ratingsTable)
        .values({ pageId, userId, kind: mode, value })
        .onConflictDoUpdate({
          target: [ratingsTable.pageId, ratingsTable.userId],
          set: { kind: mode, value, updatedAt: new Date() }
        })
    )
  }

  /**
   * Withdraw this reader's rating of a page. Idempotent: no row is the outcome asked for.
   *
   * @returns The page's totals as they stand after the withdrawal.
   */
  async unrate({ pageId, userId }: { pageId: string; userId: string }): Promise<PageRatingsCache> {
    return this.#changeAndRecount(pageId, (tx) =>
      tx
        .delete(ratingsTable)
        .where(and(eq(ratingsTable.pageId, pageId), eq(ratingsTable.userId, userId)))
    )
  }

  /**
   * Recount the totals cached on every page, on every site, from the ratings table.
   *
   * The cache is only rewritten when one of a page's ratings changes, so anything that alters the
   * rows without going through `rate` / `unrate` leaves it behind until the page is next rated — a
   * deleted account's cascade, an import, a hand edit of the table. This is the way to put it right
   * without waiting for that.
   *
   * Every page row is locked first, for the same reason `#changeAndRecount` locks the one it
   * rewrites: a rating committed between counting and writing would otherwise be left out of the
   * total written. Locked in id order so that two rebuilds cannot deadlock on each other.
   *
   * @returns How many pages had a cache that did not match their ratings.
   */
  async rebuildAll(): Promise<number> {
    return WIKI.db.transaction(async (tx) => {
      await tx.select({ id: pagesTable.id }).from(pagesTable).orderBy(pagesTable.id).for('update')

      const countedKinds = inArray(ratingsTable.kind, [...RATING_MODES])
      const perKind = tx
        .select({
          pageId: ratingsTable.pageId,
          kind: ratingsTable.kind,
          count: sql<number>`count(*)::int`.as('count'),
          sum: sql<number>`coalesce(sum(${ratingsTable.value}), 0)::int`.as('sum'),
          up: sql<number>`(count(*) filter (where ${ratingsTable.value} > 0))::int`.as('up'),
          down: sql<number>`(count(*) filter (where ${ratingsTable.value} < 0))::int`.as('down')
        })
        .from(ratingsTable)
        .where(countedKinds)
        .groupBy(ratingsTable.pageId, ratingsTable.kind)
        .as('perKind')
      const perPage = tx
        .select({
          pageId: perKind.pageId,
          cache:
            sql<PageRatingsCache>`jsonb_object_agg(${perKind.kind}, jsonb_build_object('count', ${perKind.count}, 'sum', ${perKind.sum}, 'up', ${perKind.up}, 'down', ${perKind.down}))`.as(
              'cache'
            )
        })
        .from(perKind)
        .groupBy(perKind.pageId)
        .as('perPage')

      // -> Pages somebody has rated, where the cache says otherwise
      const recounted = await tx
        .update(pagesTable)
        .set({ ratings: sql`${perPage.cache}` })
        .from(perPage)
        .where(
          and(
            eq(perPage.pageId, pagesTable.id),
            sql`${pagesTable.ratings} is distinct from ${perPage.cache}`
          )
        )
        .returning({ id: pagesTable.id })

      // -> Pages nobody has rated, still carrying totals
      const cleared = await tx
        .update(pagesTable)
        .set({ ratings: {} })
        .where(
          and(
            ne(pagesTable.ratings, {}),
            not(
              exists(
                tx
                  .select({ one: sql`1` })
                  .from(ratingsTable)
                  .where(and(eq(ratingsTable.pageId, pagesTable.id), countedKinds))
              )
            )
          )
        )
        .returning({ id: pagesTable.id })

      return recounted.length + cleared.length
    })
  }

  /**
   * Apply a change to a page's ratings and rewrite the totals cached on it, in one transaction.
   *
   * The page row is locked first. Two readers rating at once would otherwise each count the rows
   * without the other's uncommitted one, and whichever committed last would cache a total that is one
   * rating short for good. Recounted rather than adjusted by the difference, so a cache that has
   * drifted (a rating removed by a deleted account's cascade) is put right by the next rating.
   */
  async #changeAndRecount(
    pageId: string,
    change: (tx: any) => Promise<unknown>
  ): Promise<PageRatingsCache> {
    return WIKI.db.transaction(async (tx) => {
      await tx
        .select({ id: pagesTable.id })
        .from(pagesTable)
        .where(eq(pagesTable.id, pageId))
        .for('update')
      await change(tx)
      const rows = await tx
        .select({
          kind: ratingsTable.kind,
          count: sql<number>`count(*)::int`,
          sum: sql<number>`coalesce(sum(${ratingsTable.value}), 0)::int`,
          up: sql<number>`(count(*) filter (where ${ratingsTable.value} > 0))::int`,
          down: sql<number>`(count(*) filter (where ${ratingsTable.value} < 0))::int`
        })
        .from(ratingsTable)
        .where(eq(ratingsTable.pageId, pageId))
        .groupBy(ratingsTable.kind)
      const cache: PageRatingsCache = {}
      for (const row of rows) {
        if ((RATING_MODES as readonly string[]).includes(row.kind)) {
          cache[row.kind as RatingMode] = {
            count: Number(row.count),
            sum: Number(row.sum),
            up: Number(row.up),
            down: Number(row.down)
          }
        }
      }
      await tx.update(pagesTable).set({ ratings: cache }).where(eq(pagesTable.id, pageId))
      return cache
    })
  }
}

export const pageRatings = new PageRatings()
