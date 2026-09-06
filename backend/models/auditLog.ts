import { and, count, desc, eq, gte, inArray, lte, lt, or, sql } from 'drizzle-orm'
import { auditLog as auditLogTable } from '../db/schema.ts'
import { sanitizeMeta } from '../helpers/audit.ts'

/**
 * The areas of the wiki an action can belong to.
 *
 * Closed in practice but stored as a varchar, so naming another one is a code change rather than a
 * migration. The admin area's filter is built from this list, and `admin.audit.kinds.<kind>` is the
 * translation of each.
 */
export const AUDIT_KINDS = ['page', 'asset', 'auth', 'profile', 'admin'] as const
export type AuditKind = (typeof AUDIT_KINDS)[number]

/**
 * Every action the wiki records, by area.
 *
 * This is the authority: the admin area's action filter is built from it, `admin.audit.actions.<key>`
 * is how each one is translated, and the documentation site lists it. A route recording an action
 * that is not here is a bug — nothing enforces it at runtime (an audit write must never fail a
 * request), but `npm run typecheck` does, since `AuditAction` is the union of these.
 *
 * Keys are camelCase and unique ACROSS areas, so that one translation key means one thing. Where two
 * areas would otherwise collide the more specific one is qualified — `forcedPasswordChange` is the
 * one a login demands, `changePassword` the one a user makes from their own profile.
 */
export const AUDIT_ACTIONS = {
  page: [
    'createPage',
    'updatePage',
    'movePage',
    'deletePage',
    'renderPage',
    'unlockPage',
    'watchPage',
    'unwatchPage',
    'submitPageEdit',
    'approvePageEdit',
    'rejectPageEdit',
    'createFolder',
    'updateFolder',
    'moveFolder',
    'duplicateFolder',
    'setFolderColor',
    'deleteFolder'
  ],
  asset: ['uploadAsset', 'updateAsset', 'deleteAsset'],
  auth: [
    'login',
    'logout',
    'register',
    'verifyEmail',
    'requestPasswordReset',
    'resetPassword',
    'forcedPasswordChange'
  ],
  profile: [
    'updateProfile',
    'updateAvatar',
    'deleteAvatar',
    'updateEditorSettings',
    'changePassword',
    'togglePasswordLogin',
    'enableTfa',
    'disableTfa',
    'registerPasskey',
    'deletePasskey'
  ],
  admin: [
    'createApiKey',
    'revokeApiKey',
    'createApprovalRule',
    'updateApprovalRule',
    'deleteApprovalRule',
    'createAuthStrategy',
    'updateAuthStrategy',
    'deleteAuthStrategy',
    'updateBlock',
    'deleteBlock',
    'createGroup',
    'updateGroup',
    'deleteGroup',
    'assignUserToGroup',
    'unassignUserFromGroup',
    'createHook',
    'updateHook',
    'deleteHook',
    'addIconSet',
    'updateIconSet',
    'deleteIconSet',
    'refreshIconSets',
    'materializeIcons',
    'flushIconCache',
    'fetchLocales',
    'installLocale',
    'updateLocale',
    'updateMailConfig',
    'sendTestEmail',
    'updatePageNavigation',
    'runScheduledTask',
    'cancelJob',
    'retryJob',
    'createSite',
    'updateSite',
    'deleteSite',
    'updateSiteImage',
    'deleteSiteImage',
    'updateStorage',
    'runStorageAction',
    'updateFlags',
    'updateSecurity',
    'updateSearchConfig',
    'rebuildSearchIndex',
    'installExtension',
    'updateApiState',
    'updateMetricsState',
    'disconnectWebsockets',
    'flushCache',
    'regenerateCertificates',
    'purgeApiKeys',
    'invalidateSessions',
    'purgePageHistory',
    'purgeSampleContent',
    'checkForUpdate',
    'createUser',
    'updateUser',
    'resetUserPassword',
    'sendWelcomeEmail',
    'deleteUser',
    'updateUserDefaults',
    'updateAuditConfig',
    'exportAuditLog'
  ]
} as const satisfies Record<AuditKind, readonly string[]>

export type AuditAction = (typeof AUDIT_ACTIONS)[AuditKind][number]

/** Every action key, flat and sorted — what the admin area's filter offers. */
export const AUDIT_ACTION_KEYS: string[] = Object.values(AUDIT_ACTIONS).flat().toSorted()

/**
 * Who did it, as the row keeps it.
 *
 * The name and email are a copy taken at the time rather than a reference, because `userId` is set to
 * null when the account is deleted and the row has to stay readable afterwards. Null for all three on
 * an action nobody was signed in for — a registration, a password reset from an emailed link.
 */
export interface AuditActor {
  id: string | null
  name: string | null
  email: string | null
  ip: string
}

/** One row as the API answers with it. */
export interface AuditEntry {
  id: string
  ts: Date
  kind: string
  action: string
  clientIP: string
  meta: Record<string, any>
  userId: string | null
}

/** One page of the log, with the total matching the filters. */
export interface AuditLogPage {
  total: number
  entries: AuditEntry[]
}

/** What `list()` narrows by. Every field is optional; together they are AND-ed. */
export interface AuditLogFilters {
  /**
   * Accounts to narrow to, OR-ed against each other — "what did any of these people do".
   *
   * A list rather than one id because the question an audit log gets asked is usually about a group
   * of people, and because the picker behind it selects a set. Empty means everybody.
   */
  userIds?: string[]
  kind?: string
  action?: string
  /** Inclusive lower bound on `ts`, as an ISO instant. */
  from?: string
  /** Inclusive upper bound on `ts`, as an ISO instant. */
  to?: string
}

/** How long rows are kept, in days. Zero means forever. */
export const DEFAULT_RETENTION_DAYS = 90

/**
 * The shortest retention that may be configured, in days. Zero — keep for ever — is the only value
 * below it.
 *
 * A floor rather than a preference, because retention is the one setting whose whole effect is to
 * destroy this table, and the person who can change it is the person the table exists to record. A
 * `manage:system` holder who could set it to a day would have a way to act, wait, and have the
 * record of what they did purged before anybody had reason to look — so the floor is what makes the
 * log outlive the window in which its subject would want it gone.
 *
 * Thirty days is not a claim that a month is enough; it is the point below which the setting stops
 * being a retention policy and starts being a way to cover tracks. Longer is a choice, shorter is
 * not offered.
 */
export const MIN_RETENTION_DAYS = 30

/**
 * Audit log model
 *
 * Rows are written by `helpers/audit.ts` from API route handlers and read by `api/auditLog.ts`.
 * Nothing else writes here — see the table's comment in `db/schema.ts` for why that boundary is the
 * feature rather than an implementation detail.
 */
class AuditLog {
  /**
   * Record one action.
   *
   * Never throws. An audit row is a record of a request that has already succeeded, and losing one is
   * not a reason to fail the request that was the point — the same trade `pageHistory.record` makes.
   * A failure is logged at error level rather than warn, because unlike a missing history entry a
   * missing audit entry is a gap in a record somebody is relying on.
   */
  async record({
    kind,
    action,
    actor,
    meta = {}
  }: {
    kind: AuditKind
    action: AuditAction
    actor: AuditActor
    meta?: Record<string, any>
  }): Promise<void> {
    try {
      await WIKI.db.insert(auditLogTable).values({
        kind,
        action,
        clientIP: actor.ip,
        userId: actor.id,
        /*
          Sanitized here rather than at each caller, so that every path in — the route helper and the
          handful of auth events that record themselves — goes through the same backstop.

          `actor` is applied AFTER it, and last, so a route cannot overwrite it by accident with a
          meta key of its own and the copy of the account cannot be redacted by a key name.
        */
        meta: {
          ...sanitizeMeta(meta),
          actor: { name: actor.name, email: actor.email, ip: actor.ip }
        }
      })
    } catch (err: any) {
      WIKI.logger.error(`Failed to record audit entry ${kind}/${action}: ${err.message}`)
    }
  }

  /**
   * The filters as one WHERE, or nothing at all when none were given.
   *
   * Shared by `list` and `stream` rather than written twice: an export that did not match the screen
   * it was taken from would be the worst kind of wrong, since nothing about the file would say so.
   */
  whereFor(filters: AuditLogFilters) {
    const conditions = []
    if (filters.userIds && filters.userIds.length > 0) {
      // -> `inArray` even for one, so the single and the many cases are the same query
      conditions.push(inArray(auditLogTable.userId, filters.userIds))
    }
    if (filters.kind) {
      conditions.push(eq(auditLogTable.kind, filters.kind))
    }
    if (filters.action) {
      conditions.push(eq(auditLogTable.action, filters.action))
    }
    if (filters.from) {
      conditions.push(gte(auditLogTable.ts, new Date(filters.from)))
    }
    if (filters.to) {
      conditions.push(lte(auditLogTable.ts, new Date(filters.to)))
    }
    return conditions.length > 0 ? and(...conditions) : undefined
  }

  /**
   * Every entry matching the filters, newest first, a batch at a time.
   *
   * A generator rather than an array because this backs the export, and the whole point of exporting
   * an audit log is that it is long: an instance with a year of history can hold millions of rows,
   * and materialising those to answer one request would take the wiki down with it. The caller
   * streams what this yields straight to the response.
   *
   * Paged by keyset — "older than the last row I sent" — rather than by OFFSET, which re-walks and
   * discards everything before it on each batch and turns one export into a quadratic scan. `id`
   * breaks ties, since two entries can share a timestamp and an unstable order would drop or repeat
   * rows across batch boundaries.
   */
  async *stream(filters: AuditLogFilters, batchSize = 1000): AsyncGenerator<AuditEntry> {
    const where = this.whereFor(filters)
    let cursor: { ts: Date; id: string } | null = null

    for (;;) {
      const keyset = cursor
        ? or(
            lt(auditLogTable.ts, cursor.ts),
            and(eq(auditLogTable.ts, cursor.ts), lt(auditLogTable.id, cursor.id))
          )
        : undefined
      const rows = (await WIKI.db
        .select()
        .from(auditLogTable)
        .where(keyset ? and(where, keyset) : where)
        .orderBy(desc(auditLogTable.ts), desc(auditLogTable.id))
        .limit(batchSize)) as AuditEntry[]

      for (const row of rows) {
        yield row
      }
      // -> A short batch is the last one; a full one may or may not be, so it costs one empty query
      if (rows.length < batchSize) {
        return
      }
      const last = rows[rows.length - 1]!
      cursor = { ts: last.ts, id: last.id }
    }
  }

  /**
   * One page of the log, newest first.
   *
   * No join to `users`: every row already carries the name and email the account had at the time, and
   * that is what should be shown. Reading the current name instead would quietly rewrite history
   * every time somebody was renamed, and would show nothing at all once they were deleted.
   *
   * @param filters What to narrow by
   * @param page 1-based page number
   * @param limit Rows per page
   */
  async list(filters: AuditLogFilters, page: number, limit: number): Promise<AuditLogPage> {
    const where = this.whereFor(filters)

    const [totals, entries] = await Promise.all([
      WIKI.db.select({ total: count() }).from(auditLogTable).where(where),
      WIKI.db
        .select()
        .from(auditLogTable)
        .where(where)
        .orderBy(desc(auditLogTable.ts))
        .limit(limit)
        .offset((page - 1) * limit)
    ])

    return {
      total: totals[0]?.total ?? 0,
      entries: entries as AuditEntry[]
    }
  }

  /**
   * How long rows are kept, in days. Zero means forever.
   *
   * The floor is applied on the way OUT as well as on the way in. `api/auditLog.ts` refuses to store
   * anything under it, so a value below it can only have arrived another way — a hand-edited
   * `config.yml`, a direct write to the settings table — and honouring it there would leave the one
   * route round the rule that the rule exists to close. Anything between 1 and the floor is read as
   * the floor rather than as itself; a value that is not a whole number of days at all falls back to
   * the default.
   */
  retentionDays(): number {
    const configured = WIKI.config.audit?.retentionDays
    if (!Number.isInteger(configured) || configured < 0) {
      return DEFAULT_RETENTION_DAYS
    }
    if (configured === 0) {
      return 0
    }
    return Math.max(configured, MIN_RETENTION_DAYS)
  }

  /**
   * Delete rows older than the configured retention.
   *
   * @returns How many rows went, or 0 when retention is off
   */
  async purge(): Promise<number> {
    const days = this.retentionDays()
    if (days < 1) {
      return 0
    }
    // -> `Instant` takes exact time units only, so days are expressed as hours
    const cutoff = Temporal.Now.instant().subtract({ hours: days * 24 })
    const deleted = await WIKI.db
      .delete(auditLogTable)
      .where(lt(auditLogTable.ts, new Date(cutoff.epochMilliseconds)))
      .returning({ id: auditLogTable.id })
    return deleted.length
  }

  /** How many rows the log holds, for the retention card in the admin area. */
  async total(): Promise<number> {
    const rows = await WIKI.db.select({ total: count() }).from(auditLogTable)
    return rows[0]?.total ?? 0
  }

  /** The instant of the oldest row, or null when the log is empty. */
  async oldestEntry(): Promise<string | null> {
    const rows = await WIKI.db
      .select({ ts: sql<Date>`min(${auditLogTable.ts})` })
      .from(auditLogTable)
    const oldest = rows[0]?.ts
    return oldest ? new Date(oldest).toISOString() : null
  }
}

export const auditLog = new AuditLog()
