import { AsyncLocalStorage } from 'node:async_hooks'
import { and, count, desc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import {
  notificationEvents as eventsTable,
  notifications as notificationsTable,
  userNotificationPrefs as prefsTable
} from '../db/schema.ts'
import { durationToSeconds } from '../helpers/common.ts'
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_KEYS,
  NOTIFICATION_SECTIONS,
  categoriesFor,
  isCategoryKey
} from '../notifications/index.ts'
import type { NotificationCategoryKey } from '../notifications/index.ts'
import { enqueueOnce } from '../notifications/queue.ts'
import { readUnsubscribeToken } from '../notifications/unsubscribe.ts'
import type { UnsubscribeClaim } from '../notifications/unsubscribe.ts'
import type {
  EventOrigin,
  NotificationCategory,
  NotificationChannel,
  NotificationEventData,
  NotificationEventKind,
  NotificationSection,
  PageSnapshot
} from '../notifications/types.ts'

/** Fields stored in the `notifications` settings blob that the admin area may change. */
export const NOTIFICATION_SETTINGS_FIELDS = [
  'retentionDays',
  'emailDelay',
  'mailBatchSize'
] as const

/** How long after the first emit in a burst the fan-out is asked for, in milliseconds. */
const DISPATCH_DEBOUNCE = 1000

/** How long a processed event is kept in the outbox, which is long enough to debug one. */
const PROCESSED_EVENT_RETENTION_HOURS = 24

/** How many rows the purge deletes at a time. */
const PURGE_BATCH_SIZE = 10000

/** Badge counts stop here; the interface shows `99+` above 99. */
const UNREAD_CAP = 100

/** The default inbox page size, and the ceiling a client may ask for. */
const INBOX_PAGE_SIZE = 30
const INBOX_PAGE_MAX = 100

/** How an event came about, when something further up the call chain has said. See `withOrigin`. */
const originScope = new AsyncLocalStorage<EventOrigin>()

/** A page, in whatever shape a model has it in hand. */
interface PageLike {
  id: string
  title: string
  path: string
  locale: string
  tags?: string[] | null
  publishState?: string | null
}

/** One category as Profile → Notifications offers it. */
export interface NotificationPref {
  key: NotificationCategoryKey
  section: NotificationSection
  defaults: Record<NotificationChannel, boolean>
  inApp: boolean
  email: boolean
}

/** One inbox entry, as the API answers with it. */
export interface InboxEntry {
  id: string
  category: string
  variant: string
  count: number
  pageId: string | null
  commentId: string | null
  actorId: string | null
  data: Record<string, unknown>
  isRead: boolean
  createdAt: Date
  updatedAt: Date
}

/** What `markRead` narrows by. Nothing at all marks every entry read. */
export interface MarkReadFilter {
  ids?: string[]
  pageId?: string
  categories?: string[]
}

/**
 * Notifications model
 *
 * The request process's side of notifications: writing events, the preferences behind Profile →
 * Notifications, the inbox, the instance settings, and the one-click unsubscribe. Turning an event
 * into entries happens in a worker (`notifications/fanout.ts`), and so does sending the mail
 * (`notifications/mailer.ts`); neither goes through here, because neither has `WIKI.models`.
 */
class Notifications {
  private dispatchTimer: NodeJS.Timeout | null = null

  // == ORIGIN =========================

  /**
   * Run some work whose events all came about the same way.
   *
   * Carried by `AsyncLocalStorage` for the reason `storage.importingFrom` is: the events are emitted
   * several models away — a folder deletion reaches `deletePage` once per page — and none of those
   * calls should need a parameter that says what is going on above them.
   */
  withOrigin<T>(origin: EventOrigin, work: () => Promise<T>): Promise<T> {
    return originScope.run(origin, work)
  }

  /** How the event being emitted now came about. */
  originNow(): EventOrigin {
    return originScope.getStore() ?? (WIKI.models.storage.isImporting() ? 'import' : 'user')
  }

  // == EMIT ===========================

  /** Whether a site has notifications at all — `features.notifications`, on unless switched off. */
  isEnabledFor(siteId: string | null | undefined): boolean {
    return !siteId || WIKI.sites[siteId]?.config?.features?.notifications !== false
  }

  /** A page as an event remembers it. */
  pageSnapshot(page: PageLike): PageSnapshot {
    return {
      id: page.id,
      title: page.title,
      path: page.path,
      locale: page.locale,
      tags: page.tags ?? [],
      publishState: page.publishState ?? 'published'
    }
  }

  /**
   * Record that something happened, for the fan-out to tell whoever it concerns.
   *
   * One INSERT and a debounced request for a fan-out run — nobody is looked up, no access is checked
   * and nothing is sent from here, so the cost on the request that caused it is the same however many
   * people end up being told. Like `hooks.emit`, it never throws: a notification problem must not fail
   * the action that triggered it. Call it after the action has succeeded.
   *
   * Nothing is written for a site with notifications switched off, nor for an event no category fires
   * for from this origin — a git pull's `page:create`, say — rather than writing it to throw away.
   *
   * @param watchersOf For a page about to be deleted: capture its watchers into the event now,
   *                   because the watch rows go with the page
   */
  async emit(
    kind: NotificationEventKind,
    {
      siteId,
      actorId,
      data,
      watchersOf
    }: {
      siteId: string
      actorId: string | null
      data: NotificationEventData
      watchersOf?: string
    }
  ): Promise<void> {
    try {
      if (!this.isEnabledFor(siteId)) {
        return
      }
      const origin = this.originNow()
      if (categoriesFor(kind, origin).length < 1) {
        return
      }
      await WIKI.db.insert(eventsTable).values({
        kind,
        origin,
        siteId,
        actorId,
        data,
        // -> In the same statement, so the ids never pass through here
        ...(watchersOf && {
          recipients: sql`ARRAY(SELECT "userId" FROM "pageWatching" WHERE "pageId" = ${watchersOf})`
        })
      })
      this.requestDispatch()
    } catch (err: any) {
      WIKI.logger.warn(`Failed to record notification event ${kind}: ${err.message}`)
    }
  }

  /**
   * Ask for a fan-out run, about a second from now.
   *
   * The first event of a burst arms the timer and the rest ride on it, so five hundred saves in a
   * minute are a handful of runs rather than five hundred jobs. An instance that goes down with the
   * timer armed owes a run, which the system schedule's safety net pays.
   */
  private requestDispatch(): void {
    if (this.dispatchTimer) {
      return
    }
    this.dispatchTimer = setTimeout(() => {
      this.dispatchTimer = null
      void enqueueOnce('dispatchNotifications')
    }, DISPATCH_DEBOUNCE)
    this.dispatchTimer.unref?.()
  }

  // == PREFERENCES ====================

  /** The categories somebody is offered, in the order the Profile screen lists them. */
  visibleCategories(actor: { permissions: string[] }): NotificationCategoryKey[] {
    return NOTIFICATION_CATEGORY_KEYS.filter((key) => {
      const category: NotificationCategory = NOTIFICATION_CATEGORIES[key]
      return !category.visibleTo || category.visibleTo(actor)
    }).sort(
      (a, b) =>
        NOTIFICATION_SECTIONS.indexOf(NOTIFICATION_CATEGORIES[a].section) -
        NOTIFICATION_SECTIONS.indexOf(NOTIFICATION_CATEGORIES[b].section)
    )
  }

  /**
   * Somebody's choices, with the default standing in wherever they made none.
   */
  async getPrefs(userId: string, actor: { permissions: string[] }): Promise<NotificationPref[]> {
    const stored = await WIKI.db
      .select({
        category: prefsTable.category,
        channel: prefsTable.channel,
        enabled: prefsTable.enabled
      })
      .from(prefsTable)
      .where(eq(prefsTable.userId, userId))
    return this.visibleCategories(actor).map((key) => {
      const category = NOTIFICATION_CATEGORIES[key]
      const chosen = (channel: NotificationChannel) =>
        stored.find((row) => row.category === key && row.channel === channel)?.enabled ??
        category.defaults[channel]
      return {
        key,
        section: category.section,
        defaults: { ...category.defaults },
        inApp: chosen('inApp'),
        email: chosen('email')
      }
    })
  }

  /**
   * Store somebody's choices.
   *
   * Only what differs from a category's default is kept: a choice set back to its default deletes its
   * row rather than writing one that says the same thing, so that a default changed later reaches
   * everybody who never chose otherwise. Categories the caller is not offered, or that the request
   * does not mention, are left as they are.
   *
   * @returns The keys of the categories whose stored choice changed
   */
  async setPrefs(
    userId: string,
    actor: { permissions: string[] },
    prefs: Record<string, Partial<Record<NotificationChannel, boolean>>>
  ): Promise<string[]> {
    const current = await this.getPrefs(userId, actor)
    const changed = new Set<string>()
    for (const pref of current) {
      const wanted = prefs[pref.key]
      if (!wanted) {
        continue
      }
      for (const channel of ['inApp', 'email'] as const) {
        if (typeof wanted[channel] !== 'boolean' || wanted[channel] === pref[channel]) {
          continue
        }
        await this.storeChoice(userId, pref.key, channel, wanted[channel])
        changed.add(pref.key)
      }
    }
    return [...changed]
  }

  private async storeChoice(
    userId: string,
    category: NotificationCategoryKey,
    channel: NotificationChannel,
    enabled: boolean
  ): Promise<void> {
    if (enabled === NOTIFICATION_CATEGORIES[category].defaults[channel]) {
      await WIKI.db
        .delete(prefsTable)
        .where(
          and(
            eq(prefsTable.userId, userId),
            eq(prefsTable.category, category),
            eq(prefsTable.channel, channel)
          )
        )
      return
    }
    await WIKI.db
      .insert(prefsTable)
      .values({ userId, category, channel, enabled })
      .onConflictDoUpdate({
        target: [prefsTable.userId, prefsTable.category, prefsTable.channel],
        set: { enabled, updatedAt: sql`now()` }
      })
  }

  /**
   * Stop emailing somebody about these categories, and drop whatever email they had waiting for them.
   *
   * What an unsubscribe does, and nothing more: in-app entries carry on, since the person asked to
   * stop receiving MAIL.
   */
  async disableEmail(userId: string, categories: NotificationCategoryKey[]): Promise<void> {
    for (const category of categories) {
      await this.storeChoice(userId, category, 'email', false)
    }
    if (categories.length > 0) {
      await WIKI.db
        .update(notificationsTable)
        .set({ emailState: 'skipped' })
        .where(
          and(
            eq(notificationsTable.userId, userId),
            eq(notificationsTable.emailState, 'pending'),
            inArray(notificationsTable.category, categories)
          )
        )
    }
  }

  // == UNSUBSCRIBE ====================

  /**
   * Honour an unsubscribe link.
   *
   * @param scope `token` for the categories the mail was about, `all` for every category there is —
   *              which the page that asks offers, and which a token may ask for since all it can do is
   *              turn email off for the person it was issued to
   * @returns What the token said, or null when it is not genuine
   */
  async unsubscribe(token: unknown, scope: 'token' | 'all'): Promise<UnsubscribeClaim | null> {
    const claim = readUnsubscribeToken(token)
    if (!claim) {
      return null
    }
    const categories =
      scope === 'all' ? NOTIFICATION_CATEGORY_KEYS : claim.categories.filter(isCategoryKey)
    await this.disableEmail(claim.userId, categories)
    return { userId: claim.userId, categories }
  }

  /** What a token says, without acting on it — for the page that asks first. */
  readToken(token: unknown): UnsubscribeClaim | null {
    const claim = readUnsubscribeToken(token)
    return claim ? { ...claim, categories: claim.categories.filter(isCategoryKey) } : null
  }

  // == INBOX ==========================

  /** The entries one site's inbox shows: its own, and those that belong to no site. */
  private inboxScope(userId: string, siteId: string) {
    return and(
      eq(notificationsTable.userId, userId),
      or(eq(notificationsTable.siteId, siteId), isNull(notificationsTable.siteId)),
      eq(notificationsTable.inApp, true)
    )
  }

  /**
   * One page of somebody's inbox, newest activity first.
   *
   * Keyset-paginated on `(updatedAt, id)` — the cursor is the last entry of the previous page — since
   * an entry that absorbs a new event moves to the top, and an offset would skip or repeat around it.
   */
  async list(
    userId: string,
    siteId: string,
    { cursor, unread, limit }: { cursor?: string; unread?: boolean; limit?: number } = {}
  ): Promise<{ entries: InboxEntry[]; next: string | null }> {
    const size = Math.min(Math.max(limit ?? INBOX_PAGE_SIZE, 1), INBOX_PAGE_MAX)
    const conditions = [this.inboxScope(userId, siteId)]
    if (unread) {
      conditions.push(isNull(notificationsTable.readAt))
    }
    const after = this.parseCursor(cursor)
    if (after) {
      conditions.push(
        sql`(${notificationsTable.updatedAt}, ${notificationsTable.id}) < (${after.updatedAt}, ${after.id})`
      )
    }
    const rows = await WIKI.db
      .select({
        id: notificationsTable.id,
        category: notificationsTable.category,
        variant: notificationsTable.variant,
        count: notificationsTable.count,
        pageId: notificationsTable.pageId,
        commentId: notificationsTable.commentId,
        actorId: notificationsTable.actorId,
        data: notificationsTable.data,
        readAt: notificationsTable.readAt,
        createdAt: notificationsTable.createdAt,
        updatedAt: notificationsTable.updatedAt
      })
      .from(notificationsTable)
      .where(and(...conditions))
      .orderBy(desc(notificationsTable.updatedAt), desc(notificationsTable.id))
      .limit(size + 1)
    const page = rows.slice(0, size)
    const last = page[page.length - 1]
    return {
      entries: page.map((row) => {
        const { readAt, data, ...rest } = row
        const { excerpt, ...snapshot } = (data ?? {}) as Record<string, unknown>
        return {
          ...rest,
          // -> A comment's text only while the comment exists: deleting it takes it out of every inbox
          data: row.commentId && excerpt !== undefined ? { ...snapshot, excerpt } : snapshot,
          isRead: readAt !== null
        }
      }),
      next: rows.length > size && last ? `${last.updatedAt.toISOString()}|${last.id}` : null
    }
  }

  private parseCursor(cursor?: string): { updatedAt: string; id: string } | null {
    if (!cursor) {
      return null
    }
    const [updatedAt, id] = cursor.split('|')
    if (!updatedAt || !id || Number.isNaN(Date.parse(updatedAt)) || !/^[0-9a-f-]{36}$/i.test(id)) {
      return null
    }
    return { updatedAt, id }
  }

  /**
   * What the badge needs, and nothing more: how many unread entries (counted no further than
   * `UNREAD_CAP`) and when the inbox last changed.
   *
   * What every open tab of a signed-in reader polls, so it is two index-only reads. The pair is also
   * what the poll's ETag is built from: anything that changes the inbox moves one of them.
   */
  async summary(
    userId: string,
    siteId: string
  ): Promise<{ unread: number; latestAt: string | null }> {
    const capped = WIKI.db
      .select({ one: sql`1` })
      .from(notificationsTable)
      .where(and(this.inboxScope(userId, siteId), isNull(notificationsTable.readAt)))
      .limit(UNREAD_CAP)
      .as('capped')
    const [[unread], [latest]] = await Promise.all([
      WIKI.db.select({ total: count() }).from(capped),
      WIKI.db
        .select({ at: sql<string | null>`max(${notificationsTable.updatedAt})` })
        .from(notificationsTable)
        .where(this.inboxScope(userId, siteId))
    ])
    return {
      unread: Number(unread?.total ?? 0),
      latestAt: latest?.at ? new Date(latest.at).toISOString() : null
    }
  }

  /**
   * Mark entries read.
   *
   * Reading an entry before its email has gone also cancels the email: the person has seen it, which
   * is all the mail was for. An entry that is read stops holding its coalescing key, so the next event
   * about the same thing starts a new entry — and, being new, a new email.
   *
   * @returns How many entries changed
   */
  async markRead(userId: string, siteId: string, filter: MarkReadFilter = {}): Promise<number> {
    const conditions = [
      eq(notificationsTable.userId, userId),
      or(eq(notificationsTable.siteId, siteId), isNull(notificationsTable.siteId)),
      isNull(notificationsTable.readAt)
    ]
    if (filter.ids) {
      if (filter.ids.length < 1) {
        return 0
      }
      conditions.push(inArray(notificationsTable.id, filter.ids))
    }
    if (filter.pageId) {
      conditions.push(eq(notificationsTable.pageId, filter.pageId))
    }
    if (filter.categories) {
      const categories = filter.categories.filter(isCategoryKey)
      if (categories.length < 1) {
        return 0
      }
      conditions.push(inArray(notificationsTable.category, categories))
    }
    const result = await WIKI.db
      .update(notificationsTable)
      .set({
        readAt: sql`now()`,
        emailState: sql`CASE WHEN ${notificationsTable.emailState} = 'pending' THEN 'skipped' ELSE ${notificationsTable.emailState} END`
      })
      .where(and(...conditions))
    return result.rowCount ?? 0
  }

  /**
   * Remove one entry from somebody's inbox.
   *
   * @returns Whether there was one to remove
   */
  async dismiss(userId: string, siteId: string, id: string): Promise<boolean> {
    const result = await WIKI.db
      .delete(notificationsTable)
      .where(
        and(
          eq(notificationsTable.id, id),
          eq(notificationsTable.userId, userId),
          or(eq(notificationsTable.siteId, siteId), isNull(notificationsTable.siteId))
        )
      )
    return (result.rowCount ?? 0) > 0
  }

  /**
   * The categories somebody has unread entries in for one page — what the page view hands the browser
   * so that opening the page, or its Talk tab, can mark them read without asking first.
   *
   * One indexed lookup, and none for a reader with no account. Never throws: it is a convenience on
   * the page view, which is started ahead of the page's other lookups and must not take the page down
   * — or go unhandled — if it fails.
   */
  async unreadCategoriesOnPage(pageId: string, userId: string | null): Promise<string[]> {
    if (!userId) {
      return []
    }
    try {
      const rows = await WIKI.db
        .selectDistinct({ category: notificationsTable.category })
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.userId, userId),
            eq(notificationsTable.pageId, pageId),
            isNull(notificationsTable.readAt)
          )
        )
      return rows.map((row) => row.category)
    } catch (err: any) {
      WIKI.logger.warn(`Failed to read unread notifications for page ${pageId}: ${err.message}`)
      return []
    }
  }

  // == SETTINGS =======================

  /** The instance settings as the admin area edits them. The unsubscribe secret is never among them. */
  getConfig(): Record<(typeof NOTIFICATION_SETTINGS_FIELDS)[number], any> {
    const stored = WIKI.config.notifications ?? {}
    return {
      retentionDays: stored.retentionDays,
      emailDelay: stored.emailDelay,
      mailBatchSize: stored.mailBatchSize
    }
  }

  /**
   * Check a patch against the settings it will be merged with.
   *
   * @returns The reason it is invalid, or null when it is fine
   */
  validate(patch: Record<string, any>): string | null {
    const merged = { ...this.getConfig(), ...patch }
    if (
      !Number.isInteger(merged.retentionDays) ||
      merged.retentionDays < 1 ||
      merged.retentionDays > 3650
    ) {
      return 'Retention must be a whole number of days between 1 and 3650.'
    }
    const delay = durationToSeconds(merged.emailDelay, 0)
    if (!/^\d+[smh]$/.test(String(merged.emailDelay ?? '')) || delay < 1 || delay > 3600) {
      return 'The email delay must be a duration such as 30s, 3m or 1h, of at most an hour.'
    }
    if (
      !Number.isInteger(merged.mailBatchSize) ||
      merged.mailBatchSize < 1 ||
      merged.mailBatchSize > 1000
    ) {
      return 'The mail batch size must be a whole number between 1 and 1000.'
    }
    return null
  }

  /**
   * Save a validated patch. The secret is carried over untouched, since the blob is written whole.
   *
   * @returns Whether the settings were saved
   */
  async updateConfig(patch: Record<string, any>): Promise<boolean> {
    const previous = WIKI.config.notifications
    const picked: Record<string, any> = {}
    for (const field of NOTIFICATION_SETTINGS_FIELDS) {
      if (patch[field] !== undefined) {
        picked[field] = patch[field]
      }
    }
    WIKI.config.notifications = { ...previous, ...picked }
    if (!(await WIKI.configSvc.saveToDb(['notifications']))) {
      WIKI.config.notifications = previous
      return false
    }
    return true
  }

  /**
   * How the system is doing, for the admin screen: what is waiting to be fanned out, how email has
   * gone over the last day, and anything about the configuration that stops email being sent.
   */
  async status(): Promise<{
    pendingEvents: number
    oldestPendingEventAt: string | null
    emailsPending: number
    emailsSent24h: number
    emailsFailed24h: number
    isMailConfigured: boolean
    warnings: string[]
  }> {
    const dayAgo = sql`now() - interval '24 hours'`
    const [[backlog], [pending], [sent], [failed]] = await Promise.all([
      WIKI.db
        .select({
          total: count(),
          oldest: sql<string | null>`min(${eventsTable.createdAt})`
        })
        .from(eventsTable)
        .where(isNull(eventsTable.processedAt)),
      WIKI.db
        .select({ total: count() })
        .from(notificationsTable)
        .where(inArray(notificationsTable.emailState, ['pending', 'sending'])),
      WIKI.db
        .select({ total: count() })
        .from(notificationsTable)
        .where(
          and(eq(notificationsTable.emailState, 'sent'), gte(notificationsTable.emailedAt, dayAgo))
        ),
      WIKI.db
        .select({ total: count() })
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.emailState, 'failed'),
            gte(notificationsTable.updatedAt, dayAgo)
          )
        )
    ])

    const warnings: string[] = []
    const baseUrl = (WIKI.config.mail?.defaultBaseURL ?? '').trim()
    if (baseUrl.toLowerCase().startsWith('http://')) {
      warnings.push('plainHttp')
    }
    if (!baseUrl && Object.values(WIKI.sites).some((site: any) => site.hostname === '*')) {
      warnings.push('wildcardHostname')
    }
    return {
      pendingEvents: Number(backlog?.total ?? 0),
      oldestPendingEventAt: backlog?.oldest ? new Date(backlog.oldest).toISOString() : null,
      emailsPending: Number(pending?.total ?? 0),
      emailsSent24h: Number(sent?.total ?? 0),
      emailsFailed24h: Number(failed?.total ?? 0),
      isMailConfigured: WIKI.models.mail.isConfigured,
      warnings
    }
  }

  // == HOUSEKEEPING ===================

  /**
   * Delete entries past retention, read or not, and processed events past a day — in batches, checking
   * between them whether the task has been asked to stop.
   */
  async purge(signal?: AbortSignal): Promise<{ notifications: number; events: number }> {
    const days = Number(WIKI.config.notifications?.retentionDays) || 60
    const purgeBatched = async (table: any, condition: any): Promise<number> => {
      let total = 0
      while (!signal?.aborted) {
        const result = await WIKI.db.execute(sql`
          DELETE FROM ${table} WHERE id IN (
            SELECT id FROM ${table} WHERE ${condition} LIMIT ${PURGE_BATCH_SIZE}
          )
        `)
        const deleted = result.rowCount ?? 0
        total += deleted
        if (deleted < PURGE_BATCH_SIZE) {
          break
        }
      }
      return total
    }
    const notifications = await purgeBatched(
      notificationsTable,
      lt(notificationsTable.createdAt, sql`now() - make_interval(days => ${days})`)
    )
    const events = await purgeBatched(
      eventsTable,
      and(
        isNotNull(eventsTable.processedAt),
        lt(
          eventsTable.processedAt,
          sql`now() - make_interval(hours => ${PROCESSED_EVENT_RETENTION_HOURS})`
        )
      )
    )
    return { notifications, events }
  }
}

export const notifications = new Notifications()
