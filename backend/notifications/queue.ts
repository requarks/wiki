import { and, eq, isNull, lte, or } from 'drizzle-orm'
import { toMerged } from 'es-toolkit/object'
import { v4 as uuid } from 'uuid'
import { jobs as jobsTable } from '../db/schema.ts'

/** The two worker tasks notifications are delivered by. */
export type NotificationTask = 'dispatchNotifications' | 'sendNotificationMail'

/**
 * Ask for a task to run, unless a run already waiting will do.
 *
 * One pending job is enough: each of these tasks drains everything that is due when it runs and asks
 * for its own next run before it stops, so a second copy queued behind the first would find nothing
 * left to do. A pending job that runs no later than `waitUntil` therefore counts. Two instances
 * deciding at the same moment can still both add one, which costs a run that finds nothing — the
 * rows themselves are claimed with `SKIP LOCKED`.
 *
 * Called from the request process and from the worker threads alike, which is why it is not just
 * `scheduler.addJob`: a worker has no scheduler. There the row is written directly and picked up on
 * the next poll (`scheduler.pollingCheck`) rather than announced, which costs a few seconds on
 * something that waits minutes on purpose.
 */
export async function enqueueOnce(task: NotificationTask, waitUntil?: Date): Promise<void> {
  try {
    const pending = await WIKI.db
      .select({ id: jobsTable.id })
      .from(jobsTable)
      .where(
        and(
          eq(jobsTable.task, task),
          waitUntil
            ? or(isNull(jobsTable.waitUntil), lte(jobsTable.waitUntil, waitUntil))
            : isNull(jobsTable.waitUntil)
        )
      )
      .limit(1)
    if (pending.length > 0) {
      return
    }
    // -> Only the request process has a scheduler — see the note on the worker's WIKI in `worker.ts`
    if (typeof WIKI.scheduler?.addJob === 'function') {
      await WIKI.scheduler.addJob({ task, waitUntil, notify: !waitUntil })
      return
    }
    await WIKI.db.insert(jobsTable).values({
      id: uuid(),
      task,
      useWorker: true,
      payload: {},
      maxRetries: WIKI.config.scheduler.maxRetries,
      waitUntil,
      createdBy: WIKI.INSTANCE_ID
    })
  } catch (err: any) {
    WIKI.logger.warn(`Failed to queue ${task}: ${err.message}`)
  }
}

/**
 * Bring a worker thread's copy of the settings up to date.
 *
 * A worker reads the settings table once, when its thread first opens the database, and never hears
 * the `reloadConfig` event the request process does — and a thread lives for many runs. Without
 * this, mail configured after the thread started would never be seen (nothing would be emailed),
 * and a changed email delay or batch size would be ignored until a restart. One small query per run.
 */
export async function refreshWorkerConfig(): Promise<void> {
  const stored = await WIKI.models.settings.getConfig()
  if (stored) {
    WIKI.config = toMerged(WIKI.config, stored)
  }
}
