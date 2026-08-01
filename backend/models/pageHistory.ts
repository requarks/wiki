import { eq } from 'drizzle-orm'
import { pageHistory as pageHistoryTable, pages as pagesTable } from '../db/schema.ts'

/**
 * The kinds of change a history row records.
 *
 * `created` and `deleted` are the two ends of a page's life; `moved` is a change of path or title,
 * which is worth telling apart from an ordinary edit because it is what breaks links; `updated` is
 * everything else, content and metadata alike.
 */
export const pageHistoryActions = ['created', 'updated', 'moved', 'deleted'] as const

export type PageHistoryAction = (typeof pageHistoryActions)[number]

/**
 * The page fields a version carries beyond the ones with columns of their own.
 *
 * Taken straight off the stored row, so a field added to a page is captured here without this list
 * being touched. The exclusions are either derived from the content (`render`, `toc`, `searchContent`,
 * `ts`), fixed for the page's whole life (`id`, `siteId`, `creatorId`, `createdAt`), or bookkeeping
 * that says nothing about the version (`hash`, `updatedAt`, `authorId`, `ratingScore`, `ratingCount`,
 * `historyData`, `isSearchableComputed`).
 */
const EXCLUDED_FROM_META = new Set([
  'id',
  'siteId',
  'creatorId',
  'createdAt',
  'updatedAt',
  'authorId',
  'hash',
  'render',
  'toc',
  'searchContent',
  'ts',
  'ratingScore',
  'ratingCount',
  'historyData',
  'isSearchableComputed',
  // -> Held in columns of their own
  'locale',
  'path',
  'title',
  'content'
])

/**
 * Fields a change is never reported as having touched.
 *
 * Either derived from the content (a render moves whenever the source does, and saying so twice tells
 * a reader nothing) or bookkeeping that moves on every save regardless.
 */
const NOT_REPORTED_AS_CHANGED = new Set([
  'render',
  'toc',
  'searchContent',
  'ts',
  'hash',
  'authorId',
  'updatedAt',
  'ratingScore',
  'ratingCount',
  'historyData',
  'isSearchableComputed'
])

/**
 * Page history model
 *
 * Records a version of a page every time one changes. Nothing reads it back yet — displaying the
 * history, comparing versions and restoring one are the next step — so this is deliberately only the
 * recording side.
 */
class PageHistory {
  /**
   * Record what a page looks like now, as a new version.
   *
   * The snapshot is read from the stored row rather than taken from the caller, so that what is
   * recorded is what was actually saved — not what the caller believed it was saving. For a deletion
   * that means this has to be called BEFORE the row goes.
   *
   * A failure here is logged and swallowed: history is a record of what happened, and losing an entry
   * is not a reason to fail the edit that was the point of the request.
   *
   * @param authorId Who made the change. Kept on the row until that account is deleted, at which
   *                 point the version survives with no author rather than blocking the deletion.
   * @param changedFields Which fields the change touched. Empty for a creation or a deletion, where
   *                      the whole page is the change.
   * @returns The version's ID, or null when nothing was recorded
   */
  async record({
    siteId,
    pageId,
    action,
    authorId,
    changedFields = []
  }: {
    siteId: string
    pageId: string
    action: PageHistoryAction
    authorId: string
    changedFields?: string[]
  }): Promise<string | null> {
    try {
      const rows = await WIKI.db.select().from(pagesTable).where(eq(pagesTable.id, pageId)).limit(1)
      const page = rows[0]
      if (!page) {
        WIKI.logger.warn(`Cannot record page history for ${pageId}: the page is not there.`)
        return null
      }

      const meta: Record<string, any> = {}
      for (const [key, value] of Object.entries(page)) {
        if (!EXCLUDED_FROM_META.has(key)) {
          meta[key] = value
        }
      }

      const inserted = await WIKI.db
        .insert(pageHistoryTable)
        .values({
          pageId,
          siteId,
          authorId,
          action,
          changedFields,
          locale: page.locale,
          path: page.path,
          title: page.title,
          content: page.content,
          meta
        })
        .returning({ id: pageHistoryTable.id })

      return inserted[0]?.id ?? null
    } catch (err: any) {
      WIKI.logger.warn(`Failed to record page history for ${pageId}: ${err.message}`)
      return null
    }
  }

  /**
   * Which of a page's fields a patch actually changes.
   *
   * Compared against the stored row rather than taken from the patch keys: a client that sends every
   * field on every save — which is what the editor does — would otherwise record every field as
   * changed on every version, and the point of this is to say what was touched.
   *
   * Fields derived from the content, and the bookkeeping that moves on every save, are left out: a
   * render changing alongside its source is not a second thing that happened.
   *
   * @param existing The page row as it stands
   * @param patch The fields being written, keyed as the page stores them
   */
  changedFields(existing: Record<string, any>, patch: Record<string, any>): string[] {
    const changed: string[] = []
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || !(key in existing) || NOT_REPORTED_AS_CHANGED.has(key)) {
        continue
      }
      // -> JSON rather than `===`: tags, relations and the config blobs are arrays and objects, and
      //    comparing those by reference reports every save as a change to all of them
      if (JSON.stringify(existing[key]) !== JSON.stringify(value)) {
        changed.push(key)
      }
    }
    return changed.sort()
  }
}

export const pageHistory = new PageHistory()
