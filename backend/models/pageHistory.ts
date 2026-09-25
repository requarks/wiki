import { isEqual } from 'es-toolkit/predicate'
import { and, desc, eq, lt, notExists, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import {
  pageHistory as pageHistoryTable,
  pages as pagesTable,
  users as usersTable
} from '../db/schema.ts'

/**
 * The kinds of change a history row records.
 *
 * `created` and `deleted` are the two ends of a page's life, and `restored` is a deleted page coming
 * back out of the recycle bin under its own id; `moved` is a change of path or title, which is worth
 * telling apart from an ordinary edit because it is what breaks links; `updated` is everything else,
 * content and metadata alike.
 */
export const pageHistoryActions = ['created', 'updated', 'moved', 'deleted', 'restored'] as const

export type PageHistoryAction = (typeof pageHistoryActions)[number]

/**
 * How far back the admin area's purge can be told to keep, and the interval each answer means.
 *
 * The values are postgres intervals rather than a duration computed here, so that the cutoff is
 * measured against the same clock the rows were written by: `versionDate` takes the column default,
 * which is `now()`, and a timestamp column carries no offset to reconcile a date computed in this
 * process against. It also gets the calendar arithmetic for free — a month is a month, whichever one
 * it lands in.
 */
export const purgeTimeframes = {
  '24h': '24 hours',
  '1m': '1 month',
  '3m': '3 months',
  '6m': '6 months',
  '1y': '1 year',
  '2y': '2 years'
} as const

export type PurgeTimeframe = keyof typeof purgeTimeframes

/**
 * The page fields a version carries beyond the ones with columns of their own.
 *
 * Taken straight off the stored row, so a field added to a page is captured here without this list
 * being touched. The exclusions are either derived from the content (`render`, `searchContent`,
 * `ts`), fixed for the page's whole life (`id`, `siteId`, `creatorId`, `createdAt`), or bookkeeping
 * that says nothing about the version (`hash`, `updatedAt`, `authorId`, `ratings`,
 * `historyData`, `isSearchableComputed`).
 *
 * `toc` is derived as well and is kept regardless, because the version view draws a contents column
 * beside the snapshot and there is nowhere else to get one: a version records the page's SOURCE, and
 * the headings only exist in the render, which is not recorded. Deriving them on the way out would
 * mean parsing the source a second time to answer what the save had already answered.
 *
 * It stays in `NOT_REPORTED_AS_CHANGED` below, which is a different question: a contents list moves
 * whenever the source does, so naming it among a version's changed fields tells a reader nothing.
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
  'searchContent',
  'ts',
  'ratings',
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
  'ratings',
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

/**
 * A page in the recycle bin, as the file manager lists it: the version recording its deletion, and
 * enough of what it was to draw a row and to check the page rules it stood under.
 */
export type DeletedPageEntry = {
  /** The deletion's own version, which is what viewing, downloading and restoring are built from. */
  versionId: string
  pageId: string
  locale: string
  path: string
  title: string
  icon: string
  editor: string
  tags: string[]
  deletedAt: Date
  deletedBy: PageHistoryAuthor
}

/** The version recording a page's deletion, with the snapshot it holds. */
export type PageDeletion = {
  id: string
  pageId: string
  locale: string
  path: string
  title: string
  content: string
  meta: Record<string, any>
  versionDate: Date
}

/** A version in full, source included. */
export type PageHistoryVersion = PageHistoryEntry & {
  content: string
  meta: Record<string, any>
}

/**
 * One version row, by whatever identifies it.
 *
 * Shared by the two ways in — page and version, or version alone — because they differ only in the
 * `where`, and a second copy of this projection is a second place for the two to drift apart.
 */
async function selectVersionRow(where: SQL | undefined): Promise<any> {
  const rows = await WIKI.db
    .select({
      id: pageHistoryTable.id,
      pageId: pageHistoryTable.pageId,
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
    .where(where)
    .limit(1)

  return rows[0] ?? null
}

/** That row as a version. `pageId` is deliberately not on it — only one caller wants it. */
function toVersion(row: any): PageHistoryVersion {
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
      // -> Null once the account is gone: the version outlives it, see the column's own note
      id: row.authorId ?? null,
      name: row.authorName ?? '',
      email: row.authorEmail ?? ''
    }
  }
}

/**
 * Page history model
 *
 * Records a version of a page every time one changes, and reads those versions back for the history
 * view — which lists them and diffs any two against each other — and for the recycle bin, which is
 * nothing more than the pages whose last version is their deletion.
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
    const row = await selectVersionRow(
      and(
        eq(pageHistoryTable.siteId, siteId),
        eq(pageHistoryTable.pageId, pageId),
        eq(pageHistoryTable.id, versionId)
      )
    )
    return row ? toVersion(row) : null
  }

  /**
   * The same version addressed by its ID ALONE, with the page it belongs to named in the reply.
   *
   * What `/_version/<id>` needs. A version URL is a link somebody was handed — out of the history
   * timeline, a notification, a message — and the one thing such a link can reasonably carry is the
   * version's own ID: the page it came off is exactly what the reader is asking to be told, and a URL
   * that already had to name it would be a URL they could not have been given in the first place.
   *
   * `pageId` comes back because the caller has permissions to check and they are page rules — the
   * version carries no access of its own, so it has to be turned back into a page first. Everything
   * else is what {@link getVersion} returns.
   *
   * Scoped to the site regardless, so a version ID from one site cannot be read through another's URL.
   *
   * @returns The version and its page, or null when this site has no such version
   */
  async getVersionById(
    siteId: string,
    versionId: string
  ): Promise<(PageHistoryVersion & { pageId: string }) | null> {
    const row = await selectVersionRow(
      and(eq(pageHistoryTable.siteId, siteId), eq(pageHistoryTable.id, versionId))
    )
    return row ? { ...toVersion(row), pageId: row.pageId } : null
  }

  /**
   * The pages in a site's recycle bin, most recently deleted first.
   *
   * A page is in the bin when its newest version is a deletion and no page row carries its id. Both
   * halves are asked: the newest row alone would be enough today, since nothing can record against a
   * page that is gone, but a page restored and deleted again has two deletions, and only the later
   * one describes it.
   *
   * Newest per page across EVERY locale, and filtered by locale only afterwards — a page that was
   * deleted in one locale, restored into another and deleted again belongs to the second, and
   * filtering first would list it in both.
   *
   * Every such page, unpaged: the page rules that decide which of these a caller may see are resolved
   * per row by the caller, so a page taken here could be a page of rows nobody may see.
   */
  async listDeleted(siteId: string, locale: string): Promise<DeletedPageEntry[]> {
    const latest = WIKI.db
      .selectDistinctOn([pageHistoryTable.pageId], {
        id: pageHistoryTable.id,
        pageId: pageHistoryTable.pageId,
        action: pageHistoryTable.action,
        locale: pageHistoryTable.locale,
        path: pageHistoryTable.path,
        title: pageHistoryTable.title,
        icon: sql<string | null>`${pageHistoryTable.meta}->>'icon'`.as('icon'),
        editor: sql<string | null>`${pageHistoryTable.meta}->>'editor'`.as('editor'),
        tags: sql<string[] | null>`${pageHistoryTable.meta}->'tags'`.as('tags'),
        versionDate: pageHistoryTable.versionDate,
        authorId: pageHistoryTable.authorId
      })
      .from(pageHistoryTable)
      .where(
        and(
          eq(pageHistoryTable.siteId, siteId),
          notExists(
            WIKI.db
              .select({ id: pagesTable.id })
              .from(pagesTable)
              .where(eq(pagesTable.id, pageHistoryTable.pageId))
          )
        )
      )
      .orderBy(
        pageHistoryTable.pageId,
        desc(pageHistoryTable.versionDate),
        desc(pageHistoryTable.id)
      )
      .as('latest')

    const rows = await WIKI.db
      .select({
        id: latest.id,
        pageId: latest.pageId,
        locale: latest.locale,
        path: latest.path,
        title: latest.title,
        icon: latest.icon,
        editor: latest.editor,
        tags: latest.tags,
        versionDate: latest.versionDate,
        authorId: usersTable.id,
        authorName: usersTable.name,
        authorEmail: usersTable.email
      })
      .from(latest)
      .leftJoin(usersTable, eq(usersTable.id, latest.authorId))
      .where(and(eq(latest.action, 'deleted'), eq(latest.locale, locale)))
      .orderBy(desc(latest.versionDate), desc(latest.id))

    return rows.map((row: any) => ({
      versionId: row.id,
      pageId: row.pageId,
      locale: row.locale,
      path: row.path,
      title: row.title,
      icon: row.icon ?? '',
      editor: row.editor || 'markdown',
      tags: Array.isArray(row.tags) ? row.tags : [],
      deletedAt: row.versionDate,
      deletedBy: {
        id: row.authorId ?? null,
        name: row.authorName ?? '',
        email: row.authorEmail ?? ''
      }
    }))
  }

  /**
   * The deletion a page is in the recycle bin by, or null when it is not in the bin — because it was
   * never deleted, because it has been restored since, or because it never existed on this site.
   *
   * The newest version of the page, and only when that version is a deletion and no page row carries
   * the id. That row is where the page was when it went, which is what its page rules are resolved
   * against, and the snapshot a restore puts back.
   */
  async deletionOf(siteId: string, pageId: string): Promise<PageDeletion | null> {
    const live = await WIKI.db
      .select({ id: pagesTable.id })
      .from(pagesTable)
      .where(eq(pagesTable.id, pageId))
      .limit(1)
    if (live.length > 0) {
      return null
    }
    const rows = await WIKI.db
      .select({
        id: pageHistoryTable.id,
        pageId: pageHistoryTable.pageId,
        action: pageHistoryTable.action,
        locale: pageHistoryTable.locale,
        path: pageHistoryTable.path,
        title: pageHistoryTable.title,
        content: pageHistoryTable.content,
        meta: pageHistoryTable.meta,
        versionDate: pageHistoryTable.versionDate
      })
      .from(pageHistoryTable)
      .where(and(eq(pageHistoryTable.siteId, siteId), eq(pageHistoryTable.pageId, pageId)))
      .orderBy(desc(pageHistoryTable.versionDate), desc(pageHistoryTable.id))
      .limit(1)
    const row = rows[0]
    if (!row || row.action !== 'deleted') {
      return null
    }
    return {
      id: row.id,
      pageId: row.pageId,
      locale: row.locale,
      path: row.path,
      title: row.title,
      content: row.content ?? '',
      meta: (row.meta ?? {}) as Record<string, any>,
      versionDate: row.versionDate
    }
  }

  /**
   * When a page first appeared and who made it, off its oldest version.
   *
   * What a restored page takes its `createdAt` and `creatorId` back from: neither is part of a
   * version's snapshot (both are fixed for the page's life, see `EXCLUDED_FROM_META`), so without
   * this every page brought back would claim to have been written the day it was restored, by
   * whoever restored it. Null when the history has been purged past the page's creation.
   */
  async originOf(
    siteId: string,
    pageId: string
  ): Promise<{ versionDate: Date; authorId: string | null } | null> {
    const rows = await WIKI.db
      .select({
        versionDate: pageHistoryTable.versionDate,
        authorId: pageHistoryTable.authorId
      })
      .from(pageHistoryTable)
      .where(
        and(
          eq(pageHistoryTable.siteId, siteId),
          eq(pageHistoryTable.pageId, pageId),
          eq(pageHistoryTable.action, 'created')
        )
      )
      .orderBy(pageHistoryTable.versionDate)
      .limit(1)
    return rows[0] ?? null
  }

  /**
   * Drop every version older than a timeframe, across every site.
   *
   * Content versioning is the only thing this touches: a page's own row holds what it says now, so
   * purging changes nothing anybody reads — it shortens timelines and takes away what a page can be
   * rolled back to. A page whose every version is older than the cutoff keeps the page and loses its
   * history entirely, which includes the `created` row saying when it appeared.
   *
   * What it does not spare is a page that no longer exists. Its versions outlive it deliberately (see
   * `db/schema.ts`), and they are all that is left of it — so purging past the day it was deleted is
   * what finally discards it. Reclaiming that space is the point of this; there is nothing to undo it
   * with.
   *
   * @param olderThan How far back to keep, as one of {@link purgeTimeframes}
   * @returns How many versions were dropped
   */
  async purge(olderThan: PurgeTimeframe): Promise<number> {
    const interval = purgeTimeframes[olderThan]
    const result = await WIKI.db
      .delete(pageHistoryTable)
      // -> The interval is bound as a parameter and cast, rather than interpolated: the value is off
      //    a closed list, but a raw fragment built from a request is a habit worth not having
      .where(lt(pageHistoryTable.versionDate, sql`now() - ${interval}::interval`))
    const purged = result.rowCount ?? 0
    WIKI.logger.info(`Purged ${purged} page version(s) older than ${interval} [ OK ]`)
    return purged
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
