import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm'
import {
  approvalRules as approvalRulesTable,
  pageWatching as watchingTable,
  userGroups as userGroupsTable,
  userNotificationPrefs as prefsTable,
  users as usersTable
} from '../db/schema.ts'
import { approvals } from '../models/approvals.ts'
import type { ApprovalRule } from '../models/approvals.ts'
import type { NotificationEvent } from './types.ts'

/**
 * Where categories find their candidates.
 *
 * Every function here yields user ids in ascending order, a batch at a time, starting strictly after
 * `after` — the contract `NotificationCategory.recipients` states, and what lets a fan-out that ran
 * out of time carry on from the last id it wrote. Keyset rather than OFFSET because the audience of
 * an opt-in category can be every account on the instance, and an offset re-reads everything before it.
 *
 * Imported by the categories, which run in a worker thread, so nothing here reaches for `WIKI.models`.
 */

/** How many candidates a category hands the fan-out at once. */
export const RECIPIENT_BATCH_SIZE = 1000

/**
 * Page through a query that answers ids in ascending order, given where to start.
 */
async function* keyset(
  after: string | null,
  fetch: (after: string | null, limit: number) => Promise<string[]>
): AsyncIterable<string[]> {
  let cursor = after
  while (true) {
    const ids = await fetch(cursor, RECIPIENT_BATCH_SIZE)
    if (ids.length > 0) {
      yield ids
    }
    if (ids.length < RECIPIENT_BATCH_SIZE) {
      return
    }
    cursor = ids[ids.length - 1]!
  }
}

/** The same contract, over a list already in hand. */
async function* fromList(ids: Iterable<string>, after: string | null): AsyncIterable<string[]> {
  const sorted = [...new Set(ids)].filter((id) => !after || id > after).sort()
  for (let i = 0; i < sorted.length; i += RECIPIENT_BATCH_SIZE) {
    yield sorted.slice(i, i + RECIPIENT_BATCH_SIZE)
  }
}

/**
 * Everybody watching the page an event is about.
 *
 * For a deletion that is the list the event was written with: the watch rows were removed with the
 * page, so the outbox row is the only place they still exist.
 */
export function watchersOf(
  event: NotificationEvent,
  after: string | null
): AsyncIterable<string[]> {
  if (event.kind === 'page:delete') {
    return fromList(event.recipients ?? [], after)
  }
  const pageId = event.data.page?.id
  if (!pageId) {
    return fromList([], after)
  }
  return keyset(after, async (cursor, limit) => {
    const rows = await WIKI.db
      .select({ userId: watchingTable.userId })
      .from(watchingTable)
      .where(
        cursor
          ? and(eq(watchingTable.pageId, pageId), gt(watchingTable.userId, cursor))
          : eq(watchingTable.pageId, pageId)
      )
      .orderBy(asc(watchingTable.userId))
      .limit(limit)
    return rows.map((row) => row.userId)
  })
}

/**
 * Everybody who has turned a category on, on either channel.
 *
 * Off the partial index on `(category, userId) WHERE enabled`, which is the whole reason the
 * preferences are a table: the users table is never scanned.
 */
export function optedInTo(category: string, after: string | null): AsyncIterable<string[]> {
  return keyset(after, async (cursor, limit) => {
    const rows = await WIKI.db
      .selectDistinct({ userId: prefsTable.userId })
      .from(prefsTable)
      .where(
        and(
          eq(prefsTable.category, category),
          eq(prefsTable.enabled, true),
          ...(cursor ? [gt(prefsTable.userId, cursor)] : [])
        )
      )
      .orderBy(asc(prefsTable.userId))
      .limit(limit)
    return rows.map((row) => row.userId)
  })
}

/**
 * The members of the reviewer groups of every enabled rule covering the page.
 *
 * Only the groups a rule names. Holding `review:pages` at the page, or `manage:system`, makes
 * someone able to answer the queue but not a recipient: on a large wiki every administrator would
 * otherwise hear about every suggestion, and an administrator who wants to is put in a reviewer group
 * like anybody else.
 *
 * Read from the table rather than from the approvals model's cache, which a worker thread does not
 * have. `matchesPage` itself is pure, so it is the model's own.
 */
export async function* reviewersOf(
  event: NotificationEvent,
  after: string | null
): AsyncIterable<string[]> {
  const page = event.data.page
  if (!page || !event.siteId) {
    return
  }
  const rules = (await WIKI.db
    .select({
      id: approvalRulesTable.id,
      name: approvalRulesTable.name,
      isEnabled: approvalRulesTable.isEnabled,
      match: approvalRulesTable.match,
      path: approvalRulesTable.path,
      submitterGroups: approvalRulesTable.submitterGroups,
      reviewerGroups: approvalRulesTable.reviewerGroups
    })
    .from(approvalRulesTable)
    .where(
      and(eq(approvalRulesTable.siteId, event.siteId), eq(approvalRulesTable.isEnabled, true))
    )) as ApprovalRule[]
  const groupIds = new Set<string>()
  for (const rule of rules) {
    if (approvals.matchesPage(rule, { path: page.path, tags: page.tags ?? [] })) {
      for (const id of rule.reviewerGroups ?? []) {
        groupIds.add(id)
      }
    }
  }
  if (groupIds.size < 1) {
    return
  }
  yield* keyset(after, async (cursor, limit) => {
    const rows = await WIKI.db
      .selectDistinct({ userId: userGroupsTable.userId })
      .from(userGroupsTable)
      .where(
        and(
          inArray(userGroupsTable.groupId, [...groupIds]),
          ...(cursor ? [gt(userGroupsTable.userId, cursor)] : [])
        )
      )
      .orderBy(asc(userGroupsTable.userId))
      .limit(limit)
    return rows.map((row) => row.userId)
  })
}

/**
 * The accounts the handles written in a comment point at.
 *
 * The handles were taken out of the text by the request that posted it, so all that is left is the
 * lookup — on the folded form the unique index is on, so `@Ana` and `@ana` are one person.
 */
export async function* mentionedIn(
  event: NotificationEvent,
  after: string | null
): AsyncIterable<string[]> {
  const handles = event.data.mentionHandles ?? []
  if (handles.length < 1) {
    return
  }
  const rows = await WIKI.db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(inArray(sql`lower(${usersTable.handle})`, handles))
  yield* fromList(
    rows.map((row) => row.id),
    after
  )
}

/**
 * Who submitted an idea on a feedback board, and everybody holding an upvote on it — the people a
 * change of its status is news to.
 *
 * The submitter is the page's creator rather than its last editor: a maintainer tidying the wording
 * of an idea does not make it theirs. Voters are read from the ratings themselves (`thumbs`, `+1`),
 * not from the totals cached on the page, which are counts and name nobody.
 */
export function submitterAndVotersOf(
  event: NotificationEvent,
  after: string | null
): AsyncIterable<string[]> {
  const pageId = event.data.page?.id
  if (!pageId) {
    return fromList([], after)
  }
  return keyset(after, async (cursor, limit) => {
    const result = await WIKI.db.execute(sql`
      SELECT id FROM (
        SELECT "creatorId" AS id FROM pages WHERE id = ${pageId}
        UNION
        SELECT "userId" AS id FROM "pageRatings"
        WHERE "pageId" = ${pageId} AND kind = 'thumbs' AND value = 1
      ) audience
      ${cursor ? sql`WHERE id > ${cursor}::uuid` : sql``}
      ORDER BY id
      LIMIT ${limit}
    `)
    return (result.rows as { id: string }[]).map((row) => row.id)
  })
}

/**
 * The owners of the page an event is about: the users it names, every active member of the groups it
 * names, or its creator when it names nobody that can still own it (see `pageOwners.ownershipOf`).
 */
export function ownersOf(event: NotificationEvent, after: string | null): AsyncIterable<string[]> {
  const pageId = event.data.page?.id
  if (!pageId) {
    return fromList([], after)
  }
  return keyset(after, async (cursor, limit) => {
    const result = await WIKI.db.execute(sql`
      SELECT u.id FROM (
        SELECT po."userId" AS id FROM "pageOwners" po
        WHERE po."pageId" = ${pageId} AND po."userId" IS NOT NULL
        UNION
        SELECT ug."userId" AS id FROM "pageOwners" po
        JOIN "userGroups" ug ON ug."groupId" = po."groupId"
        WHERE po."pageId" = ${pageId}
        UNION
        SELECT p."creatorId" AS id FROM pages p
        WHERE p.id = ${pageId} AND NOT EXISTS (
          SELECT 1 FROM "pageOwners" po
          LEFT JOIN users ou ON ou.id = po."userId"
          WHERE po."pageId" = ${pageId}
            AND (po."groupId" IS NOT NULL OR (ou."isActive" AND NOT ou."isSystem"))
        )
      ) audience
      JOIN users u ON u.id = audience.id AND u."isActive" AND NOT u."isSystem"
      ${cursor ? sql`WHERE u.id > ${cursor}::uuid` : sql``}
      ORDER BY u.id
      LIMIT ${limit}
    `)
    return (result.rows as { id: string }[]).map((row) => row.id)
  })
}

/** A single id, or nobody. */
export function only(id: string | null | undefined, after: string | null): AsyncIterable<string[]> {
  return fromList(id ? [id] : [], after)
}
