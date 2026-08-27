import {
  jobs as jobsTable,
  jobSchedule as jobScheduleTable,
  jobLock as jobLockTable,
  jobHistory as jobHistoryTable
} from '../db/schema.ts'
import { and, count, desc, eq, inArray, lte, not, sql } from 'drizzle-orm'

/** The states a job can be in once it has been picked up for execution. */
export const JOB_STATES = ['active', 'completed', 'failed', 'interrupted'] as const
export type JobState = (typeof JOB_STATES)[number]

/** One page of job history, with the total matching the requested states. */
export interface JobHistoryPage {
  total: number
  jobs: (typeof jobHistoryTable.$inferSelect)[]
}

/** One entry of the system's own cron schedule. */
interface SystemScheduleEntry {
  task: string
  cron: string
}

/**
 * The system's cron schedule, in full.
 *
 * This is the definition, not a seed: `reconcileSchedule()` makes the `jobSchedule` rows of type
 * `system` match it on every boot. Adding a task here is therefore all it takes to have every
 * instance start running it — a list that was only inserted on first run would leave a task nobody's
 * database had ever heard of unscheduled forever, which is exactly what happened to
 * `syncStorageTargets`.
 *
 * A `type: 'user'` row is nothing to do with this and is never touched.
 */
export const SYSTEM_SCHEDULE: SystemScheduleEntry[] = [
  { task: 'checkVersion', cron: '0 0 * * *' },
  { task: 'cleanJobHistory', cron: '5 0 * * *' },
  // { task: 'refreshAutocomplete', cron: '0 */6 * * *' },
  { task: 'purgeRateLimits', cron: '10 * * * *' },
  { task: 'updateLocales', cron: '0 0 * * *' },
  // -> Every minute, and the task decides which sites are actually due: the interval is a per-site
  //    setting, so the tick has to be as fine as the shortest one anybody can ask for
  { task: 'syncStorageTargets', cron: '* * * * *' }
]

/**
 * Advisory lock held for the length of `reconcileSchedule()`'s transaction.
 *
 * Every instance reconciles as it boots, and a restarted HA set boots them together — without this
 * they all read the same missing row and all insert it. Transaction-scoped, so it is released with
 * the commit whatever happens.
 */
const SCHEDULE_LOCK_KEY = 4210001

/**
 * Jobs model
 *
 * Three tables back the scheduler, and the admin area shows all three: `jobSchedule` holds the cron
 * definitions, `jobs` is the pending queue, and `jobHistory` records every execution. A job moves
 * from `jobs` to `jobHistory` when a worker picks it up — see `core/scheduler.ts`.
 */
class Jobs {
  /**
   * Initialize jobs table
   *
   * Only the cron lock: the schedule itself is `reconcileSchedule()`'s, on this boot and every one
   * after it.
   */
  async init(): Promise<void> {
    await WIKI.db.insert(jobLockTable).values({
      key: 'cron',
      lastCheckedBy: 'init',
      // NOTE: an ISO string, not a Date, is passed deliberately — pg sends it verbatim and
      // postgres parses it as UTC, whereas a JS Date would be serialized in the process's local
      // timezone. Kept as-is; the cast only silences the column's `Date` type.
      lastCheckedAt: Temporal.Now.instant()
        .subtract({ hours: 1 })
        .toString({ smallestUnit: 'millisecond' }) as any
    })
  }

  /**
   * Bring the `system` cron entries in line with `SYSTEM_SCHEDULE`.
   *
   * Runs on every boot, which is what makes the code the authority on what the wiki runs on a
   * schedule: a task added to the list appears on an existing instance, a task removed from it stops
   * being queued, and a changed cron takes effect. A row deleted by hand comes back, too.
   *
   * Pending iterations of anything that changed are dropped, since `scheduler.addScheduled()` only
   * ever adds: left alone, a task whose cron just changed would keep running at its old times for
   * the next 24 hours, and one that no longer exists would be queued for a task the scheduler cannot
   * load.
   */
  async reconcileSchedule(): Promise<void> {
    await WIKI.db.transaction(async (trx: any) => {
      await trx.execute(sql`SELECT pg_advisory_xact_lock(${SCHEDULE_LOCK_KEY}::bigint)`)

      const existing = await trx
        .select()
        .from(jobScheduleTable)
        .where(eq(jobScheduleTable.type, 'system'))

      const wanted = new Map(SYSTEM_SCHEDULE.map((entry) => [entry.task, entry]))
      const kept = new Set<string>()
      const staleIds: string[] = []
      // -> Tasks whose queued iterations no longer match what is scheduled for them
      const dirtyTasks = new Set<string>()

      for (const row of existing) {
        const entry = wanted.get(row.task)
        // -> A task that is gone, or a duplicate of one already kept: either way this row goes
        if (!entry || kept.has(row.task)) {
          staleIds.push(row.id)
          dirtyTasks.add(row.task)
          continue
        }
        kept.add(row.task)
        if (row.cron !== entry.cron) {
          await trx
            .update(jobScheduleTable)
            .set({
              cron: entry.cron,
              updatedAt: new Date(Temporal.Now.instant().epochMilliseconds)
            })
            .where(eq(jobScheduleTable.id, row.id))
          dirtyTasks.add(row.task)
        }
      }

      if (staleIds.length > 0) {
        await trx.delete(jobScheduleTable).where(inArray(jobScheduleTable.id, staleIds))
      }

      const missing = SYSTEM_SCHEDULE.filter((entry) => !kept.has(entry.task))
      if (missing.length > 0) {
        await trx.insert(jobScheduleTable).values(
          missing.map((entry) => ({
            task: entry.task,
            cron: entry.cron,
            type: 'system'
          }))
        )
        for (const entry of missing) {
          dirtyTasks.add(entry.task)
        }
      }

      if (dirtyTasks.size > 0) {
        await trx
          .delete(jobsTable)
          .where(and(eq(jobsTable.isScheduled, true), inArray(jobsTable.task, [...dirtyTasks])))
        WIKI.logger.info(
          `Scheduled tasks reconciled: ${[...dirtyTasks].sort().join(', ')} [ UPDATED ]`
        )
      }
    })
  }

  /**
   * Whether the scheduler is keeping up with its cron duties.
   *
   * Exactly one instance holds the `cron` lock at a time and refreshes it as it queues the next
   * batch of scheduled jobs, so a stale timestamp means no instance is running that check any more.
   * The lock is only re-acquired once it is 5 minutes old, and the check itself runs on an interval,
   * so the threshold has to be a comfortable multiple of that to avoid crying wolf.
   */
  async isHealthy(): Promise<boolean> {
    const results = await WIKI.db
      .select({ lastCheckedAt: jobLockTable.lastCheckedAt })
      .from(jobLockTable)
      .where(eq(jobLockTable.key, 'cron'))
      .limit(1)
    const lastCheckedAt = results[0]?.lastCheckedAt
    if (!lastCheckedAt) {
      return false
    }
    return (
      Temporal.Instant.compare(
        lastCheckedAt.toTemporalInstant(),
        Temporal.Now.instant().subtract({ minutes: 15 })
      ) > 0
    )
  }

  /**
   * How many jobs are running right now, across every instance.
   *
   * A job occupies exactly one worker slot from the moment it is claimed — `core/scheduler.ts`
   * moves it into the history as `active` and bumps `activeWorkers` in the same step — so this is
   * the cluster-wide equivalent of that per-instance counter.
   *
   * An instance that dies mid-job leaves its row saying `active` until `reapStaleJobs` picks it up,
   * which counts here in the meantime, exactly as it still shows under the scheduler's active tab.
   */
  async countActive(): Promise<number> {
    return WIKI.db.$count(jobHistoryTable, eq(jobHistoryTable.state, 'active'))
  }

  /**
   * The cron schedule: which tasks run automatically and how often
   */
  async getSchedule() {
    return WIKI.db.select().from(jobScheduleTable).orderBy(jobScheduleTable.task)
  }

  /**
   * A single cron entry, or null if there is no such entry
   */
  async getScheduleEntry(id: string) {
    const results = await WIKI.db
      .select()
      .from(jobScheduleTable)
      .where(eq(jobScheduleTable.id, id))
      .limit(1)
    return results[0] ?? null
  }

  /**
   * Queue a cron entry's task to run at the next opportunity.
   *
   * The job is deliberately *not* flagged as scheduled: it is an on-demand run, so it must not be
   * mistaken for one of the planned iterations that `scheduler.addScheduled()` reconciles.
   *
   * @returns The new job's ID, or null if the scheduler refused it
   */
  async runScheduledTask(entry: typeof jobScheduleTable.$inferSelect): Promise<string | null> {
    const added = await WIKI.scheduler.addJob({
      task: entry.task,
      payload: entry.payload ?? {}
    })
    return added?.id ?? null
  }

  /**
   * The pending queue, soonest first. Jobs with no `waitUntil` are eligible right away, so they
   * come before any dated ones.
   */
  async getUpcoming() {
    return WIKI.db
      .select()
      .from(jobsTable)
      .orderBy(sql`${jobsTable.waitUntil} ASC NULLS FIRST`, jobsTable.createdAt)
  }

  /**
   * Job execution history, most recently started first.
   *
   * @param states Keep only these states; all of them when empty
   * @param limit Caps the rows returned — `total` still counts every match, so a caller can tell
   *              that it is looking at a truncated view
   */
  async getHistory({
    states = [],
    limit = 100
  }: { states?: JobState[]; limit?: number } = {}): Promise<JobHistoryPage> {
    const where = states.length > 0 ? inArray(jobHistoryTable.state, states) : undefined
    const totals = await WIKI.db.select({ total: count() }).from(jobHistoryTable).where(where)
    const jobs = await WIKI.db
      .select()
      .from(jobHistoryTable)
      .where(where)
      .orderBy(desc(jobHistoryTable.startedAt))
      .limit(limit)

    return {
      total: totals[0]?.total ?? 0,
      jobs
    }
  }

  /**
   * A single history entry, or null if no such job ever ran
   */
  async getHistoryEntry(id: string) {
    const results = await WIKI.db
      .select()
      .from(jobHistoryTable)
      .where(eq(jobHistoryTable.id, id))
      .limit(1)
    return results[0] ?? null
  }

  /**
   * Drop a job from the pending queue.
   *
   * Only queued jobs can be cancelled: once an instance has picked one up it is gone from `jobs`
   * and already running.
   *
   * @returns Whether a queued job was removed
   */
  async cancelUpcoming(id: string): Promise<boolean> {
    const result = await WIKI.db.delete(jobsTable).where(eq(jobsTable.id, id))
    return (result.rowCount ?? 0) > 0
  }

  /**
   * Queue a fresh run of a past job.
   *
   * The original history entry is left alone and the new run gets its own entry with a full retry
   * budget — history is a log of executions, not a mutable job record.
   *
   * @returns The new job's ID, or null if the scheduler refused it
   */
  async retryJob(entry: typeof jobHistoryTable.$inferSelect): Promise<string | null> {
    const added = await WIKI.scheduler.addJob({
      task: entry.task,
      payload: entry.payload ?? {},
      maxRetries: entry.maxRetries
    })
    return added?.id ?? null
  }

  /**
   * Purge old job history
   */
  async cleanHistory(): Promise<void> {
    await WIKI.db.delete(jobHistoryTable).where(
      and(
        not(eq(jobHistoryTable.state, 'active')),
        lte(
          jobHistoryTable.startedAt,
          new Date(
            Temporal.Now.instant().subtract({
              seconds: WIKI.config.scheduler.historyExpiration
            }).epochMilliseconds
          )
        )
      )
    )
  }
}

export const jobs = new Jobs()
