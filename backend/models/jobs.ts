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
   */
  async init(): Promise<void> {
    WIKI.logger.info('Inserting scheduled jobs...')

    await WIKI.db.insert(jobScheduleTable).values([
      {
        task: 'checkVersion',
        cron: '0 0 * * *',
        type: 'system'
      },
      {
        task: 'cleanJobHistory',
        cron: '5 0 * * *',
        type: 'system'
      },
      // {
      //   task: 'refreshAutocomplete',
      //   cron: '0 */6 * * *',
      //   type: 'system'
      // },
      {
        task: 'purgeRateLimits',
        cron: '10 * * * *',
        type: 'system'
      },
      {
        task: 'updateLocales',
        cron: '0 0 * * *',
        type: 'system'
      }
    ])

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
