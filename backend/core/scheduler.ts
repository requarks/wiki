import { DynamicThreadPool } from 'poolifier'
import os from 'node:os'
import fs from 'node:fs/promises'
import path from 'node:path'
import { CronExpressionParser } from 'cron-parser'
import { v4 as uuid } from 'uuid'
import { createDeferred, type Deferred } from '../helpers/common.ts'
import { createNotifier } from '../helpers/pubsub.ts'
import { camelCase } from 'es-toolkit/string'
import { remove } from 'es-toolkit/array'
import {
  jobs as jobsTable,
  jobLock as jobLockTable,
  jobSchedule as jobScheduleTable,
  jobHistory as jobHistoryTable
} from '../db/schema.ts'
import { and, eq, inArray, lt, sql } from 'drizzle-orm'
import type { PoolClient } from 'pg'

/** An in-process task, loaded from `tasks/simple/`. */
export type SimpleTask = (payload?: any) => Promise<void> | void

/** Fallback for `scheduler.taskTimeout`, in seconds, when nothing is configured. */
const DEFAULT_TASK_TIMEOUT = 300

/** Fallback for `scheduler.staleJobTimeout`, in seconds, when nothing is configured. */
const DEFAULT_STALE_JOB_TIMEOUT = 3600

/**
 * How much longer than the task timeout the scheduler waits before giving up on its own.
 *
 * The abort is the polite route — the pool aborts a task that is merely slow, and rejects with a
 * `TimeoutError` naming what happened. This grace period lets that answer arrive first, and only
 * covers the case where nothing is going to answer at all.
 */
const TASK_TIMEOUT_GRACE = 5000

/**
 * Sends the scheduler's cross-instance notifications, one at a time.
 *
 * Nothing here awaits a notification: a job being added or finishing should not wait on a round trip,
 * and `processJob` runs concurrently with itself, so two notifications easily meet on the one client.
 */
const notifier = createNotifier(() => WIKI.scheduler.pubsubClient, 'scheduler')

/** A pending `addJob({ promise: true })` caller, waiting on the `jobCompleted` event. */
interface CompletionPromise {
  id: string
  added: Temporal.Instant
  resolve: Deferred['resolve']
  reject: Deferred['reject']
}

export interface AddJobOptions {
  /** The task name to execute. */
  task: string
  /** An optional data object to pass to the job. */
  payload?: any
  /** An optional datetime after which the task is allowed to run. */
  waitUntil?: Date
  /** The number of times this job can be restarted upon failure. Uses server defaults if not provided. */
  maxRetries?: number
  /** Whether this is a scheduled job. */
  isScheduled?: boolean
  /** Whether to notify all instances that a new job is available. */
  notify?: boolean
  /** Whether to return a promise property that resolves when the job completes. */
  promise?: boolean
}

export default {
  workerPool: null as DynamicThreadPool<any, boolean> | null,
  pubsubClient: null as PoolClient | null,
  maxWorkers: 1,
  activeWorkers: 0,
  pollingRef: null as NodeJS.Timeout | null,
  scheduledRef: null as NodeJS.Timeout | null,
  tasks: null as Record<string, SimpleTask> | null,
  completionPromises: [] as CompletionPromise[],
  async init() {
    this.maxWorkers =
      WIKI.config.scheduler.workers === 'auto'
        ? os.cpus().length - 1
        : WIKI.config.scheduler.workers
    if (this.maxWorkers < 1) {
      this.maxWorkers = 1
    }
    WIKI.logger.info(`Initializing Worker Pool (Limit: ${this.maxWorkers})...`)
    this.workerPool = new DynamicThreadPool(
      1,
      this.maxWorkers,
      path.join(WIKI.SERVERPATH, 'worker.ts'),
      {
        errorHandler: (err: Error) => WIKI.logger.warn(err),
        exitHandler: () => WIKI.logger.debug('A worker has gone offline.'),
        onlineHandler: () => WIKI.logger.debug('New worker is online.')
      }
    )
    this.tasks = {}
    for (const f of await fs.readdir(path.join(WIKI.SERVERPATH, 'tasks/simple'))) {
      const taskName = camelCase(f.replace(/\.[jt]s$/, ''))
      this.tasks[taskName] = (await import(path.join(WIKI.SERVERPATH, 'tasks/simple', f))).task
    }
    return this
  },
  async start(): Promise<void> {
    WIKI.logger.info('Starting Scheduler...')

    const connectionAppName = `Wiki.js - ${WIKI.INSTANCE_ID}:SCHEDULER`
    this.pubsubClient = await WIKI.dbManager.pool!.connect()
    await this.pubsubClient!.query(`SET application_name = '${connectionAppName}'`)

    // -> Outbound events handling

    await this.pubsubClient!.query('LISTEN scheduler')
    this.pubsubClient!.on('notification', async (msg) => {
      if (msg.channel !== 'scheduler') {
        return
      }
      try {
        const decoded = JSON.parse(msg.payload!)
        switch (decoded?.event) {
          case 'newJob': {
            // -> No counting here: `processJob` accounts for the jobs it actually claims, and
            //    counting this call as a worker as well would hide one slot for its duration
            if (this.activeWorkers < this.maxWorkers) {
              await this.processJob()
            }
            break
          }
          case 'jobCompleted': {
            const jobPromise = this.completionPromises.find((p) => p.id === decoded.id)
            if (jobPromise) {
              if (decoded.state === 'success') {
                jobPromise.resolve()
              } else {
                jobPromise.reject(new Error(decoded.errorMessage))
              }
              setTimeout(() => {
                remove(this.completionPromises, (p) => p.id === decoded.id)
              })
            }
            break
          }
        }
      } catch {}
    })

    // -> Start scheduled jobs check
    this.scheduledRef = setInterval(async () => {
      this.addScheduled()
      this.reapStaleJobs()
    }, WIKI.config.scheduler.scheduledCheck * 1000)

    // -> Add scheduled jobs on init
    await this.addScheduled()

    /*
      Anything left claimed but unfinished, before this instance starts claiming more. Most often
      that is what this very instance abandoned when it last went down — but it runs on the interval
      as well, since an instance that never comes back cannot clean up after itself.
    */
    await this.reapStaleJobs()

    // -> Start job polling
    this.pollingRef = setInterval(async () => {
      this.processJob()
    }, WIKI.config.scheduler.pollingCheck * 1000)

    WIKI.logger.info('Scheduler: [ STARTED ]')
  },
  /**
   * Add a job to the scheduler
   */
  async addJob({
    task,
    payload = {},
    waitUntil,
    maxRetries,
    isScheduled = false,
    notify = true,
    promise = false
  }: AddJobOptions): Promise<{ id: string; promise?: Promise<void> } | undefined> {
    try {
      const jobId = uuid()
      const jobDefer = createDeferred()
      if (promise) {
        this.completionPromises.push({
          id: jobId,
          added: Temporal.Now.instant(),
          resolve: jobDefer.resolve,
          reject: jobDefer.reject
        })
      }
      await WIKI.db.insert(jobsTable).values({
        id: jobId,
        task,
        useWorker: !(typeof this.tasks![task] === 'function'),
        payload,
        maxRetries: maxRetries ?? WIKI.config.scheduler.maxRetries,
        isScheduled,
        waitUntil,
        createdBy: WIKI.INSTANCE_ID
      })
      if (notify) {
        notifier.send(
          'scheduler',
          JSON.stringify({
            source: WIKI.INSTANCE_ID,
            event: 'newJob',
            id: jobId
          })
        )
      }
      return {
        id: jobId,
        ...(promise && { promise: jobDefer.promise })
      }
    } catch (err: any) {
      WIKI.logger.warn(`Failed to add job to scheduler: ${err.message}`)
    }
  },
  /**
   * Run a job in a worker thread, and stop waiting for it if it does not come back.
   *
   * A task promise that never settles is not a hypothetical: a worker thread that dies mid-task —
   * `process.exit`, an OOM kill, a native crash — takes the answer with it. Poolifier reports the
   * exit through its `exitHandler` but has nothing to attach it to, so the promise this awaits stays
   * pending forever, and with it everything the caller is holding: the job stays claimed, its history
   * row stays `active`, and the transaction around this never commits.
   *
   * Two ceilings, because they cover different failures. The abort signal is for a task that is still
   * running and merely slow — the pool aborts it and rejects, so the worker stops doing the work as
   * well. The timer is for the case where there is no longer anybody to abort, and is what makes the
   * wait finite no matter what happened to the thread.
   *
   * Either way the job ends up in the same place a thrown task does: recorded as failed, and retried
   * with the usual backoff.
   */
  async executeOnWorker(job: { task: string; payload?: any }): Promise<void> {
    const timeoutMs = (WIKI.config.scheduler.taskTimeout ?? DEFAULT_TASK_TIMEOUT) * 1000
    let timer: NodeJS.Timeout | undefined
    try {
      await Promise.race([
        this.workerPool!.execute(
          { ...job, INSTANCE_ID: `${WIKI.INSTANCE_ID}:WKR` },
          undefined,
          AbortSignal.timeout(timeoutMs)
        ),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            reject(
              new Error(
                `The worker running this task did not answer within ${timeoutMs / 1000}s. It may have crashed.`
              )
            )
          }, timeoutMs + TASK_TIMEOUT_GRACE)
        })
      ])
    } finally {
      clearTimeout(timer)
    }
  },

  /**
   * Take a batch of due jobs and run them.
   *
   * Two steps, deliberately not one transaction. Claiming a job has to be atomic — the `DELETE` with
   * `SKIP LOCKED` is what stops two instances running the same job, and the history row saying it
   * started belongs with it — but running it does not: a task takes as long as whatever it is waiting
   * on, and a transaction held open across that pins a pooled connection, holds the locks the claim
   * took, and stops postgres vacuuming anything newer than its snapshot for the duration.
   *
   * So the transaction covers the claim and nothing else, and the work happens after it commits, all
   * of the batch at once rather than one job at a time — the worker pool is there to be used, and the
   * batch was sized to it.
   *
   * The cost of committing the claim first is that a process which dies mid-job no longer has its
   * claim rolled back: the job is gone from the queue and its history row is left saying `active`.
   * That is what `reapStaleJobs` is for.
   */
  async processJob(): Promise<void> {
    const availableWorkers = this.maxWorkers - this.activeWorkers
    if (availableWorkers < 1) {
      WIKI.logger.debug('All workers are busy. Cannot process more jobs at the moment.')
      return
    }

    let jobs: any[] = []
    try {
      jobs = await WIKI.db.transaction(async (trx: any) => {
        const claimed = await trx
          .delete(jobsTable)
          .where(
            inArray(
              jobsTable.id,
              sql`(SELECT id FROM jobs WHERE ("waitUntil" IS NULL OR "waitUntil" <= NOW()) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT ${availableWorkers})`
            )
          )
          .returning()
        for (const job of claimed) {
          // -> In the same transaction as the claim: a claim that rolls back must not leave a history
          //    row behind saying the job started
          await trx
            .insert(jobHistoryTable)
            .values({
              id: job.id,
              task: job.task,
              state: 'active',
              useWorker: job.useWorker,
              wasScheduled: job.isScheduled,
              payload: job.payload,
              attempt: job.retries + 1,
              maxRetries: job.maxRetries,
              executedBy: WIKI.INSTANCE_ID,
              createdAt: job.createdAt
            })
            .onConflictDoUpdate({
              target: jobHistoryTable.id,
              set: { state: 'active', executedBy: WIKI.INSTANCE_ID, startedAt: sql`now()` }
            })
        }
        return claimed
      })
    } catch (err: any) {
      // -> Nothing was claimed: the transaction rolled back, so the jobs are still queued
      WIKI.logger.warn(err)
      return
    }

    if (jobs.length < 1) {
      return
    }

    this.activeWorkers += jobs.length
    try {
      // -> `allSettled`, though `runJob` handles its own failures: one job that manages to throw
      //    anyway must not abandon the bookkeeping of the others
      await Promise.allSettled(jobs.map((job) => this.runJob(job)))
    } finally {
      this.activeWorkers -= jobs.length
    }
  },
  /**
   * Run one already-claimed job and record how it went.
   *
   * Runs outside any transaction, so every write here is on its own — which is also why a failure
   * cannot undo the ones before it. A job that fails is recorded as failed and requeued with the
   * scheduler's backoff, and its siblings in the batch are unaffected either way.
   */
  async runJob(job: any): Promise<void> {
    WIKI.logger.info(`Processing new job ${job.id}: ${job.task}...`)
    try {
      if (job.useWorker) {
        await this.executeOnWorker(job)
      } else {
        await this.tasks![job.task](job.payload)
      }
      await WIKI.db
        .update(jobHistoryTable)
        .set({
          state: 'completed',
          completedAt: sql`now()`
        })
        .where(eq(jobHistoryTable.id, job.id))
      WIKI.logger.info(`Completed job ${job.id}: ${job.task}`)
      notifier.send(
        'scheduler',
        JSON.stringify({
          source: WIKI.INSTANCE_ID,
          event: 'jobCompleted',
          state: 'success',
          id: job.id
        })
      )
    } catch (err: any) {
      WIKI.logger.warn(`Failed to complete job ${job.id}: ${job.task} [ FAILED ]`)
      WIKI.logger.warn(err)
      try {
        await WIKI.db
          .update(jobHistoryTable)
          .set({
            attempt: job.retries + 1,
            state: 'failed',
            lastErrorMessage: err.message
          })
          .where(eq(jobHistoryTable.id, job.id))
        notifier.send(
          'scheduler',
          JSON.stringify({
            source: WIKI.INSTANCE_ID,
            event: 'jobCompleted',
            state: 'failed',
            id: job.id,
            errorMessage: err.message
          })
        )
        // -> Reschedule for retry
        if (job.retries < job.maxRetries) {
          const backoffDelay = 2 ** job.retries * WIKI.config.scheduler.retryBackoff
          await WIKI.db.insert(jobsTable).values({
            ...job,
            retries: job.retries + 1,
            waitUntil: new Date(
              Temporal.Now.instant().add({ seconds: backoffDelay }).epochMilliseconds
            ),
            updatedAt: new Date()
          })
          WIKI.logger.warn(`Rescheduling new attempt for job ${job.id}: ${job.task}...`)
        }
      } catch (recordErr: any) {
        // -> The task's failure is already logged; this is the database refusing to hear about it,
        //    which leaves the job looking active until `reapStaleJobs` picks it up
        WIKI.logger.warn(`Could not record the failure of job ${job.id}: ${recordErr.message}`)
      }
    }
  },
  /**
   * Requeue jobs that were claimed and never finished.
   *
   * A job is claimed out of `jobs` and marked `active` in the history before it runs, so an instance
   * that dies mid-job — or a worker that takes its answer with it — leaves a row saying a job started
   * that nothing is going to finish. Nothing else notices those: they are no longer in the queue.
   *
   * Age is the only usable signal. `INSTANCE_ID` is a fresh nanoid on every boot, so an instance
   * cannot pick out the rows of its own previous life, and another instance's `active` row may well
   * be a job that is running perfectly happily. `staleJobTimeout` is therefore a "nobody could still
   * be working on this" threshold rather than a deadline — generous on purpose, because the cost of
   * setting it too low is running a job that was already running.
   *
   * The `UPDATE` is the claim: two instances sweeping at once both filter on `state = 'active'`, so
   * whichever commits second matches nothing and returns nothing.
   *
   * @returns How many jobs were requeued
   */
  async reapStaleJobs(): Promise<number> {
    try {
      const staleAfter = WIKI.config.scheduler.staleJobTimeout ?? DEFAULT_STALE_JOB_TIMEOUT
      const cutoff = new Date(
        Temporal.Now.instant().subtract({ seconds: staleAfter }).epochMilliseconds
      )
      const stranded = await WIKI.db
        .update(jobHistoryTable)
        .set({
          state: 'interrupted',
          lastErrorMessage: `No instance reported on this job within ${staleAfter}s. Whatever was running it is gone.`
        })
        .where(and(eq(jobHistoryTable.state, 'active'), lt(jobHistoryTable.startedAt, cutoff)))
        .returning()

      let requeued = 0
      for (const job of stranded) {
        // -> Its remaining attempts are what they were: being interrupted is a failed attempt, and a
        //    job that had already used them up is not owed another one
        if (job.attempt > job.maxRetries) {
          WIKI.logger.warn(
            `Job ${job.id}: ${job.task} was interrupted and has no attempts left [ SKIPPED ]`
          )
          continue
        }
        await WIKI.db.insert(jobsTable).values({
          id: job.id,
          task: job.task,
          useWorker: job.useWorker,
          payload: job.payload,
          retries: job.attempt,
          maxRetries: job.maxRetries,
          isScheduled: job.wasScheduled,
          createdBy: WIKI.INSTANCE_ID
        })
        requeued++
      }
      if (stranded.length > 0) {
        WIKI.logger.warn(
          `Found ${stranded.length} interrupted job(s), ${requeued} of them requeued [ OK ]`
        )
      }
      return requeued
    } catch (err: any) {
      WIKI.logger.warn(`Failed to requeue interrupted jobs: ${err.message}`)
      return 0
    }
  },
  async addScheduled(): Promise<void> {
    try {
      await WIKI.db.transaction(async (trx: any) => {
        // -> Acquire lock
        const jobLock = await trx
          .update(jobLockTable)
          .set({
            lastCheckedBy: WIKI.INSTANCE_ID,
            lastCheckedAt: Temporal.Now.instant().toString({ smallestUnit: 'millisecond' })
          })
          .where(
            eq(
              jobLockTable.key,
              sql`(SELECT "jobLock"."key" FROM "jobLock" WHERE "jobLock"."key" = 'cron' AND "jobLock"."lastCheckedAt" <= ${Temporal.Now.instant().subtract({ minutes: 5 }).toString({ smallestUnit: 'millisecond' })} FOR UPDATE SKIP LOCKED LIMIT 1)`
            )
          )

        if (jobLock.rowCount > 0) {
          WIKI.logger.info('Scheduling future planned jobs...')
          const scheduledJobs = await WIKI.db.select().from(jobScheduleTable)
          if (scheduledJobs?.length > 0) {
            // -> Get existing scheduled jobs
            const existingJobs = await WIKI.db
              .select()
              .from(jobsTable)
              .where(eq(jobsTable.isScheduled, true))
            let totalAdded = 0
            for (const job of scheduledJobs) {
              // -> Get next planned iterations
              const plannedIterations = CronExpressionParser.parse(job.cron, {
                startDate: Temporal.Now.instant().toString({ smallestUnit: 'millisecond' }),
                // -> 24 hours rather than `{ days: 1 }`: Temporal.Instant only accepts exact time
                //    units, and in UTC a calendar day is exactly 24 hours anyway.
                endDate: Temporal.Now.instant()
                  .add({ hours: 24, minutes: 5 })
                  .toString({ smallestUnit: 'millisecond' }),
                tz: 'UTC'
              })
              /*
                At most 6 iterations of a task are queued ahead, and `take` is what stops there --
                and stops early where the window above holds fewer, since it gives back what it
                reached rather than throwing at the end of it.

                The cap is a horizon rather than a quota: an iteration already queued still spends
                one of the six, so what is pending for a task never runs further ahead than its next
                six runs however often this runs. Counting only the ones added would push that
                horizon out on every pass, until a minute-by-minute task had the whole window queued.
              */
              for (const iteration of plannedIterations.take(6)) {
                const waitUntil = iteration.toDate()
                // -> Ensure this iteration isn't already scheduled
                if (
                  existingJobs.some(
                    (j) => j.task === job.task && j.waitUntil?.getTime() === waitUntil.getTime()
                  )
                ) {
                  continue
                }
                /*
                  Awaited, because `totalAdded` is reported as what was scheduled: left to run on its
                  own, the line below says so before the rows exist, and a failure to insert one is
                  swallowed inside `addJob` with nothing to correct the count.
                */
                await this.addJob({
                  task: job.task,
                  payload: job.payload,
                  isScheduled: true,
                  waitUntil,
                  notify: false
                })
                totalAdded++
              }
            }
            if (totalAdded > 0) {
              WIKI.logger.info(`Scheduled ${totalAdded} new future planned jobs: [ OK ]`)
            } else {
              WIKI.logger.info('No new future planned jobs to schedule: [ OK ]')
            }
          }
        }
      })
    } catch (err: any) {
      WIKI.logger.warn(err)
    }
  },
  async stop(): Promise<void> {
    WIKI.logger.info('Stopping Scheduler...')
    clearInterval(this.scheduledRef!)
    clearInterval(this.pollingRef!)
    await this.workerPool!.destroy()
    WIKI.logger.info('Scheduler: [ STOPPED ]')
  }
}
