import { isEqual } from 'es-toolkit/predicate'
import { and, desc, eq } from 'drizzle-orm'
import {
  pageHistory as pageHistoryTable,
  pages as pagesTable,
  users as usersTable
} from '../db/schema.ts'

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

/** Who a version is attributed to. Null once that account is gone; the version stays. */
export type PageHistoryAuthor = {
  id: string | null
  name: string
  email: string
}

/** A version as a timeline shows it: what happened, when, and to whom — but not the source. */
export type PageHistoryEntry = {
  id: string
  action: string
  changedFields: string[]
  /** Empty when the site does not ask for a reason, or asked and was not answered. */
  reason: string
  versionDate: Date
  path: string
  title: string
  author: PageHistoryAuthor
}

/** A version in full, source included. */
export type PageHistoryVersion = PageHistoryEntry & {
  content: string
  meta: Record<string, any>
}

/**
 * Page history model
 *
 * Records a version of a page every time one changes, and reads those versions back for the history
 * view — which lists them and diffs any two against each other. Restoring one, and recovering a page
 * that was deleted, are still to come.
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
   * @param reason Why, in the author's words, when the site asks for one.
   * @returns The version's ID, or null when nothing was recorded
   */
  async record({
    siteId,
    pageId,
    action,
    authorId,
    changedFields = [],
    reason
  }: {
    siteId: string
    pageId: string
    action: PageHistoryAction
    authorId: string
    changedFields?: string[]
    reason?: string | null
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
          // -> An unanswered optional prompt sends an empty string; a version simply has no reason
          reason: reason?.trim() || null,
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
   * A page's versions, newest first — the order a timeline reads in.
   *
   * The newest row is the page as it stands: it was written after the change that produced the state
   * the page is in now. No content here; a list of forty versions has no business carrying forty
   * copies of the page.
   */
  async list(siteId: string, pageId: string): Promise<PageHistoryEntry[]> {
    const rows = await WIKI.db
      .select({
        id: pageHistoryTable.id,
        action: pageHistoryTable.action,
        changedFields: pageHistoryTable.changedFields,
        reason: pageHistoryTable.reason,
        versionDate: pageHistoryTable.versionDate,
        path: pageHistoryTable.path,
        title: pageHistoryTable.title,
        authorId: usersTable.id,
        authorName: usersTable.name,
        authorEmail: usersTable.email
      })
      .from(pageHistoryTable)
      .leftJoin(usersTable, eq(usersTable.id, pageHistoryTable.authorId))
      .where(and(eq(pageHistoryTable.siteId, siteId), eq(pageHistoryTable.pageId, pageId)))
      .orderBy(desc(pageHistoryTable.versionDate), desc(pageHistoryTable.id))

    return rows.map((row: any) => ({
      id: row.id,
      action: row.action,
      changedFields: row.changedFields ?? [],
      reason: row.reason ?? '',
      versionDate: row.versionDate,
      path: row.path,
      title: row.title,
      author: {
        // -> Null once the account is gone: the version outlives it, see the column's own note
        id: row.authorId ?? null,
        name: row.authorName ?? '',
        email: row.authorEmail ?? ''
      }
    }))
  }

  /**
   * One version, with the source it held — the side of a diff.
   *
   * @returns The version, or null when this page has no such version
   */
  async getVersion(
    siteId: string,
    pageId: string,
    versionId: string
  ): Promise<PageHistoryVersion | null> {
    const rows = await WIKI.db
      .select({
        id: pageHistoryTable.id,
        action: pageHistoryTable.action,
        changedFields: pageHistoryTable.changedFields,
        reason: pageHistoryTable.reason,
        versionDate: pageHistoryTable.versionDate,
        path: pageHistoryTable.path,
        title: pageHistoryTable.title,
        content: pageHistoryTable.content,
        meta: pageHistoryTable.meta,
        authorId: usersTable.id,
        authorName: usersTable.name,
        authorEmail: usersTable.email
      })
      .from(pageHistoryTable)
      .leftJoin(usersTable, eq(usersTable.id, pageHistoryTable.authorId))
      .where(
        and(
          eq(pageHistoryTable.siteId, siteId),
          eq(pageHistoryTable.pageId, pageId),
          eq(pageHistoryTable.id, versionId)
        )
      )
      .limit(1)

    const row: any = rows[0]
    if (!row) {
      return null
    }
    return {
      id: row.id,
      action: row.action,
      changedFields: row.changedFields ?? [],
      reason: row.reason ?? '',
      versionDate: row.versionDate,
      path: row.path,
      title: row.title,
      content: row.content ?? '',
      meta: (row.meta ?? {}) as Record<string, any>,
      author: {
        id: row.authorId ?? null,
        name: row.authorName ?? '',
        email: row.authorEmail ?? ''
      }
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
      /*
        Deep rather than `===`: tags, relations and the config blobs are arrays and objects, and
        comparing those by reference reports every save as a change to all of them.

        Not `JSON.stringify` either, which was the same bug one level down. Postgres stores a `jsonb`
        column with its keys in its own order — by length, then bytewise — so `config` came back as
        `showToc, showTags, tocDepth, …` while `buildConfig` produces them in its own fixed order.
        Two identical objects, two different strings, and `config` and `scripts` were therefore
        reported as changed on every single save.
      */
      if (!isEqual(existing[key], value)) {
        changed.push(key)
      }
    }
    return changed.sort()
  }
}

export const pageHistory = new PageHistory()
