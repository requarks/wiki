import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import {
  groups as groupsTable,
  notificationEvents as eventsTable,
  notifications as notificationsTable,
  pages as pagesTable,
  userGroups as userGroupsTable,
  userNotificationPrefs as prefsTable,
  users as usersTable
} from '../db/schema.ts'
import { durationToSeconds } from '../helpers/common.ts'
import { rulesAllow } from '../helpers/pageRules.ts'
import { mail } from '../models/mail.ts'
import type { GroupRule } from '../models/groups.ts'
import { categoriesFor } from './index.ts'
import { enqueueOnce } from './queue.ts'
import { rulePageOf } from './types.ts'
import type { NotificationCategory, NotificationEvent } from './types.ts'

/**
 * The fan-out: turning what happened into who is told.
 *
 * Runs in a worker thread (`tasks/workers/dispatch-notifications.ts`), so it reads everything it
 * needs from the database rather than from `WIKI.models` — the group rules included, which the
 * request process keeps in memory and a worker does not have.
 *
 * For each event, each category that cares about it, in priority order; for each category, its
 * candidates a batch at a time; for each batch, the same five steps whatever the category: leave the
 * actor out, drop accounts that cannot receive anything, check access, apply preferences, and write
 * the entries. Doing those here rather than in the categories is what stops one of them from getting
 * one wrong.
 */

/** How many events one claim takes. */
const EVENT_BATCH_SIZE = 50

/** How many entries go into one INSERT. */
const INSERT_CHUNK_SIZE = 500

/** The email delay when nothing is configured, in seconds. */
const DEFAULT_EMAIL_DELAY = 180

/** How far an interrupted fan-out got: which category, and the last candidate written for it. */
interface FanOutCursor {
  category: string
  after: string | null
}

/** An event as a run holds it: the outbox row, with whatever an earlier run left of its progress. */
type ClaimedEvent = NotificationEvent & { cursor: FanOutCursor | null }

/** A group as an access check needs it. */
interface GroupAccess {
  rules: GroupRule[]
  permissions: string[]
}

/** A candidate who survived the first cut, with what the rest of the steps need to know. */
interface Recipient {
  id: string
  isVerified: boolean
  groupIds: string[]
}

/**
 * Everything one run reads once and every batch uses: the groups' rules and permissions, and the
 * memo of access decisions made against them.
 */
class RunContext {
  groups = new Map<string, GroupAccess>()
  /**
   * Access decisions, keyed by permission, page and the set of groups asking.
   *
   * The whole reason a large audience is cheap: a page permission depends on nothing about a user but
   * the groups they are in, and ten thousand accounts on a wiki are usually a handful of combinations
   * of groups. Each combination is evaluated once per event, however many people share it.
   */
  decisions = new Map<string, boolean>()
  emailDelaySeconds = DEFAULT_EMAIL_DELAY
  mailConfigured = false

  async load(): Promise<void> {
    const rows = await WIKI.db
      .select({
        id: groupsTable.id,
        rules: groupsTable.rules,
        permissions: groupsTable.permissions
      })
      .from(groupsTable)
    for (const row of rows) {
      this.groups.set(row.id, {
        rules: (row.rules ?? []) as GroupRule[],
        permissions: (row.permissions ?? []) as string[]
      })
    }
    this.emailDelaySeconds = durationToSeconds(
      WIKI.config.notifications?.emailDelay,
      DEFAULT_EMAIL_DELAY
    )
    this.mailConfigured = mail.isConfigured
  }

  /**
   * Whether a set of groups may do this to the page the event is about — `groups.checkAccess`, asked
   * of the rows this run read rather than of the request process's cache.
   */
  mayAccess(event: NotificationEvent, permission: string, groupIds: string[]): boolean {
    const page = rulePageOf(event)
    if (!page) {
      return false
    }
    const key = `${event.id}|${permission}|${[...groupIds].sort().join(',')}`
    const known = this.decisions.get(key)
    if (known !== undefined) {
      return known
    }
    const pooled = groupIds.map((id) => this.groups.get(id)).filter(Boolean) as GroupAccess[]
    const allowed =
      pooled.some((group) => group.permissions.includes('manage:system')) ||
      rulesAllow(
        pooled.flatMap((group) => group.rules),
        permission,
        page
      )
    this.decisions.set(key, allowed)
    return allowed
  }
}

/**
 * Claim the next batch of events.
 *
 * `SKIP LOCKED` so that several instances can drain the outbox at once without two of them taking
 * the same event, and a claim older than the task timeout counts as abandoned: whatever held it has
 * stopped without saying so, and the cursor it left is where the next claim carries on.
 *
 * `= ANY(ARRAY(...))` and not `IN (...)`: postgres may plan an IN subquery as a semi join that re-runs
 * it per outer row, each run skipping the rows already claimed, so the LIMIT stops limiting and the
 * whole outbox is claimed at once. ARRAY() is evaluated exactly once.
 */
async function claimEvents(): Promise<ClaimedEvent[]> {
  const staleSeconds = (WIKI.config.scheduler?.taskTimeout ?? 300) + 60
  const result = await WIKI.db.execute(sql`
    UPDATE ${eventsTable}
    SET "claimedAt" = now(), "claimedBy" = ${WIKI.INSTANCE_ID}
    WHERE id = ANY(ARRAY(
      SELECT id FROM ${eventsTable}
      WHERE "processedAt" IS NULL
        AND ("claimedAt" IS NULL OR "claimedAt" < now() - make_interval(secs => ${staleSeconds}))
      ORDER BY "createdAt"
      LIMIT ${EVENT_BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    ))
    RETURNING id, kind, origin, "siteId", "actorId", data, recipients, cursor, "createdAt"
  `)
  return (result.rows as any[])
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      origin: row.origin,
      siteId: row.siteId,
      actorId: row.actorId,
      data: row.data ?? {},
      recipients: row.recipients ?? null,
      cursor: row.cursor ?? null
    }))
}

/**
 * The candidates in a batch who can receive anything at all: active, not a system account, and not
 * whoever caused the event — nobody is told about their own action.
 */
async function recipientsAmong(event: NotificationEvent, ids: string[]): Promise<Recipient[]> {
  const candidates = ids.filter((id) => id !== event.actorId)
  if (candidates.length < 1) {
    return []
  }
  const rows = await WIKI.db
    .select({
      id: usersTable.id,
      isVerified: usersTable.isVerified,
      // -> As text: the driver parses a text[] into an array, but leaves a uuid[] as its literal
      groupIds: sql<
        string[]
      >`coalesce(array_agg(${userGroupsTable.groupId}::text) filter (where ${userGroupsTable.groupId} is not null), '{}')`
    })
    .from(usersTable)
    .leftJoin(userGroupsTable, eq(userGroupsTable.userId, usersTable.id))
    .where(
      and(
        inArray(usersTable.id, candidates),
        eq(usersTable.isActive, true),
        eq(usersTable.isSystem, false)
      )
    )
    .groupBy(usersTable.id)
  return rows
}

/**
 * Each recipient's channels for this category: their stored choice where they made one, the
 * category's default where they did not.
 */
async function channelsFor(
  category: NotificationCategory,
  userIds: string[]
): Promise<Map<string, { inApp: boolean; email: boolean }>> {
  const stored = await WIKI.db
    .select({
      userId: prefsTable.userId,
      channel: prefsTable.channel,
      enabled: prefsTable.enabled
    })
    .from(prefsTable)
    .where(and(eq(prefsTable.category, category.key), inArray(prefsTable.userId, userIds)))
  const channels = new Map(userIds.map((id) => [id, { ...category.defaults }]))
  for (const row of stored) {
    const entry = channels.get(row.userId)
    if (entry && (row.channel === 'inApp' || row.channel === 'email')) {
      entry[row.channel] = row.enabled
    }
  }
  return channels
}

/**
 * Who in this batch already has an entry for this very event.
 *
 * Covers both ways that happens. A higher-priority category of the same event got to them first — a
 * comment that mentions somebody watching the page is their mention and not also a watched-page
 * comment, which is why categories are processed highest first. And a fan-out that died after
 * writing part of a batch is being replayed. Reading it back rather than holding a set in memory is
 * what makes both survive a fan-out that is carried on by a different run.
 */
async function alreadyNotified(event: NotificationEvent, userIds: string[]): Promise<Set<string>> {
  const rows = await WIKI.db
    .select({ userId: notificationsTable.userId })
    .from(notificationsTable)
    .where(
      and(inArray(notificationsTable.userId, userIds), eq(notificationsTable.lastEventId, event.id))
    )
  return new Set(rows.map((row) => row.userId))
}

/**
 * When a new entry's email may go out — the one place that is decided.
 *
 * Today it is the instance's email delay from now, the window in which whatever else happens to the
 * same thing joins the same mail. It is also where a per-user digest schedule (hourly, daily) would
 * attach: such a schedule is a later answer here, and nothing in the mail drain has to change for it,
 * since the drain sends whatever `emailAfter` says is due and never asks why.
 */
function emailAfterFor(ctx: RunContext): Date {
  return new Date(Date.now() + ctx.emailDelaySeconds * 1000)
}

/**
 * One batch of candidates for one category, written.
 *
 * @returns Whether anything was written with an email to send
 */
async function deliverBatch(
  ctx: RunContext,
  event: NotificationEvent,
  category: NotificationCategory,
  ids: string[]
): Promise<boolean> {
  let recipients = await recipientsAmong(event, ids)
  if (category.access) {
    recipients = recipients.filter((r) => ctx.mayAccess(event, category.access!, r.groupIds))
  }
  if (recipients.length < 1) {
    return false
  }
  const channels = await channelsFor(
    category,
    recipients.map((r) => r.id)
  )
  recipients = recipients.filter((r) => {
    const chosen = channels.get(r.id)!
    return chosen.inApp || chosen.email
  })
  if (recipients.length < 1) {
    return false
  }
  const done = await alreadyNotified(
    event,
    recipients.map((r) => r.id)
  )
  recipients = recipients.filter((r) => !done.has(r.id))
  if (recipients.length < 1) {
    return false
  }

  const entry = category.entry(event)
  const groupKey = category.groupKey(event)
  const siteId = category.scope === 'site' ? event.siteId : null
  const emailAfter = emailAfterFor(ctx)
  let anyEmail = false

  const values = recipients.map((r) => {
    const chosen = channels.get(r.id)!
    // -> Unverified: the address has not been confirmed, so nothing is sent to it yet
    const email = chosen.email && ctx.mailConfigured && r.isVerified
    anyEmail ||= email
    return {
      userId: r.id,
      siteId,
      category: category.key,
      variant: entry.variant,
      groupKey,
      pageId: entry.pageId ?? null,
      commentId: entry.commentId ?? null,
      actorId: event.actorId,
      data: entry.data,
      lastEventId: event.id,
      inApp: chosen.inApp,
      emailState: email ? 'pending' : 'none',
      emailAfter: email ? emailAfter : null
    }
  })

  for (let i = 0; i < values.length; i += INSERT_CHUNK_SIZE) {
    await WIKI.db
      .insert(notificationsTable)
      .values(values.slice(i, i + INSERT_CHUNK_SIZE))
      .onConflictDoUpdate({
        target: [notificationsTable.userId, notificationsTable.groupKey],
        targetWhere: sql`"readAt" IS NULL`,
        /*
          An entry nobody has read yet absorbs the event instead of being joined by a second one.

          Email follows the cadence in the spec (§10.2): one already due stays due and takes this event
          with it; one already SENT stays sent, so a page edited all afternoon is one email until it is
          looked at. An entry with no email waiting — the channel was off, or the last attempt was
          given up on — gets one if this event asks for it.
        */
        set: {
          count: sql`${notificationsTable.count} + 1`,
          variant: sql`excluded.variant`,
          pageId: sql`excluded."pageId"`,
          commentId: sql`excluded."commentId"`,
          actorId: sql`excluded."actorId"`,
          data: sql`excluded.data || jsonb_build_object('variants', (
            SELECT coalesce(jsonb_agg(DISTINCT v), '[]'::jsonb)
            FROM jsonb_array_elements(
              coalesce(${notificationsTable.data} -> 'variants', '[]'::jsonb) ||
              coalesce(excluded.data -> 'variants', '[]'::jsonb)
            ) AS v
          ))`,
          lastEventId: sql`excluded."lastEventId"`,
          inApp: sql`excluded."inApp"`,
          emailState: sql`CASE
            WHEN ${notificationsTable.emailState} IN ('none', 'failed', 'skipped') AND excluded."emailState" = 'pending'
            THEN 'pending' ELSE ${notificationsTable.emailState} END`,
          emailAfter: sql`CASE
            WHEN ${notificationsTable.emailState} IN ('none', 'failed', 'skipped') AND excluded."emailState" = 'pending'
            THEN excluded."emailAfter" ELSE ${notificationsTable.emailAfter} END`,
          updatedAt: sql`now()`
        },
        // -> The same event a second time is a replay, and changes nothing
        setWhere: sql`${notificationsTable.lastEventId} IS DISTINCT FROM excluded."lastEventId"`
      })
  }
  return anyEmail
}

/**
 * Whether an event still describes something that happened.
 *
 * A deletion is written before the page goes, because the watchers go with it. If the page is still
 * there, the delete failed after the event was written, and nobody is told about a deletion that did
 * not happen. (A page deleted and restored before this ran is indistinguishable, and is not told
 * about either — the page is there.)
 */
async function stillHappened(event: NotificationEvent): Promise<boolean> {
  if (event.kind !== 'page:delete' || !event.data.page?.id) {
    return true
  }
  const rows = await WIKI.db
    .select({ id: pagesTable.id })
    .from(pagesTable)
    .where(eq(pagesTable.id, event.data.page.id))
    .limit(1)
  return rows.length < 1
}

/**
 * The actor's name as it stands now, which is close enough to "at the time" — this runs seconds after
 * the event. Looked up here rather than when the event is written so that writing one stays a single
 * INSERT on the request path.
 */
async function withActorName(event: NotificationEvent): Promise<NotificationEvent> {
  if (event.data.actorName !== undefined || !event.actorId) {
    return event
  }
  const rows = await WIKI.db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, event.actorId))
    .limit(1)
  return { ...event, data: { ...event.data, actorName: rows[0]?.name ?? null } }
}

/**
 * Fan one event out, from wherever an earlier run left it.
 *
 * @returns The cursor to carry on from, or null when the event is done
 */
async function processEvent(
  ctx: RunContext,
  claimed: ClaimedEvent,
  signal: AbortSignal,
  onEmail: () => void
): Promise<FanOutCursor | null> {
  if (!(await stillHappened(claimed))) {
    return null
  }
  const event = await withActorName(claimed)
  const categories = categoriesFor(event.kind, event.origin).filter(
    (category) => !category.appliesTo || category.appliesTo(event)
  )
  let start = 0
  if (claimed.cursor) {
    const index = categories.findIndex((category) => category.key === claimed.cursor!.category)
    start = index < 0 ? categories.length : index
  }
  for (let i = start; i < categories.length; i++) {
    const category = categories[i]!
    const after = i === start ? (claimed.cursor?.after ?? null) : null
    for await (const ids of category.recipients(event, after)) {
      if (await deliverBatch(ctx, event, category, ids)) {
        onEmail()
      }
      if (signal.aborted) {
        return { category: category.key, after: ids[ids.length - 1]! }
      }
    }
  }
  return null
}

/**
 * Drain the outbox, as far as the run is allowed to go.
 *
 * Stops between batches when `signal` is aborted, leaving each event it had not finished with the
 * cursor it reached and its claim released, so that the next run carries on rather than starting
 * the event again. Asks for that next run itself, and for a mail run once there is something to send.
 */
export async function dispatchPending(signal: AbortSignal): Promise<void> {
  const ctx = new RunContext()
  await ctx.load()
  let anyEmail = false
  let processed = 0

  while (!signal.aborted) {
    const events = await claimEvents()
    if (events.length < 1) {
      break
    }
    for (const event of events) {
      if (signal.aborted) {
        // -> Not started: let it go for the next run to claim
        await WIKI.db
          .update(eventsTable)
          .set({ claimedAt: null, claimedBy: null })
          .where(eq(eventsTable.id, event.id))
        continue
      }
      let cursor: FanOutCursor | null
      try {
        cursor = await processEvent(ctx, event, signal, () => {
          anyEmail = true
        })
      } catch (err: any) {
        // -> Released rather than marked done, so the next run tries it again from its cursor
        WIKI.logger.warn(`Failed to dispatch notification event ${event.id}: ${err.message}`)
        await WIKI.db
          .update(eventsTable)
          .set({ claimedAt: null, claimedBy: null })
          .where(eq(eventsTable.id, event.id))
        continue
      }
      await WIKI.db
        .update(eventsTable)
        .set(
          cursor
            ? { cursor, claimedAt: null, claimedBy: null }
            : { cursor: null, processedAt: sql`now()` }
        )
        .where(eq(eventsTable.id, event.id))
      if (!cursor) {
        processed++
      }
    }
  }

  if (processed > 0) {
    WIKI.logger.debug(`Dispatched ${processed} notification event(s).`)
  }
  if (anyEmail) {
    await enqueueOnce('sendNotificationMail', emailAfterFor(ctx))
  }
  // -> Something is still waiting and nobody holds it, which is either more than one run could take
  //    or what this one let go when it was told to stop. A claim somebody abandoned is picked up by
  //    the scheduled run once it has gone stale
  const remaining = await WIKI.db
    .select({ id: eventsTable.id })
    .from(eventsTable)
    .where(and(isNull(eventsTable.processedAt), isNull(eventsTable.claimedAt)))
    .limit(1)
  if (remaining.length > 0) {
    await enqueueOnce('dispatchNotifications')
  }
}
