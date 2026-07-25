import { DynamicThreadPool } from 'poolifier'
import os from 'node:os'
import fs from 'node:fs/promises'
import path from 'node:path'
import { CronExpressionParser } from 'cron-parser'
import { v4 as uuid } from 'uuid'
import { createDeferred, type Deferred } from '../helpers/common.ts'
import { camelCase } from 'es-toolkit/string'
import { remove } from 'es-toolkit/array'
import {
  jobs as jobsTable,
  jobLock as jobLockTable,
  jobSchedule as jobScheduleTable,
  jobHistory as jobHistoryTable
} from '../db/schema.ts'
import { eq, inArray, sql } from 'drizzle-orm'
import type { PoolClient } from 'pg'

/** An in-process task, loaded from `tasks/simple/`. */
export type SimpleTask = (payload?: any) => Promise<void> | void

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

    this.pubsubClient!.query('LISTEN scheduler')
    this.pubsubClient!.on('notification', async (msg) => {
      if (msg.channel !== 'scheduler') {
        return
      }
      try {
        const decoded = JSON.parse(msg.payload!)
        switch (decoded?.event) {
          case 'newJob': {
            if (this.activeWorkers < this.maxWorkers) {
              this.activeWorkers++
              await this.processJob()
              this.activeWorkers--
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
    }, WIKI.config.scheduler.scheduledCheck * 1000)

    // -> Add scheduled jobs on init
    await this.addScheduled()

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
        this.pubsubClient!.query(`SELECT pg_notify($1, $2)`, [
          'scheduler',
          JSON.stringify({
            source: WIKI.INSTANCE_ID,
            event: 'newJob',
            id: jobId
          })
        ])
      }
      return {
        id: jobId,
        ...(promise && { promise: jobDefer.promise })
      }
    } catch (err: any) {
      WIKI.logger.warn(`Failed to add job to scheduler: ${err.message}`)
    }
  },
  async processJob(): Promise<void> {
    const jobIds: string[] = []
    try {
      const availableWorkers = this.maxWorkers - this.activeWorkers
      if (availableWorkers < 1) {
        WIKI.logger.debug('All workers are busy. Cannot process more jobs at the moment.')
        return
      }

      await WIKI.db.transaction(async (trx: any) => {
        const jobs = await trx
          .delete(jobsTable)
          .where(
            inArray(
              jobsTable.id,
              sql`(SELECT id FROM jobs WHERE ("waitUntil" IS NULL OR "waitUntil" <= NOW()) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT ${availableWorkers})`
            )
          )
          .returning()
        if (jobs && jobs.length > 0) {
          for (const job of jobs) {
            WIKI.logger.info(`Processing new job ${job.id}: ${job.task}...`)
            // -> Add to Job History
            await WIKI.db
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
                set: { executedBy: WIKI.INSTANCE_ID, startedAt: sql`now()` }
              })
            jobIds.push(job.id)

            // -> Start working on it
            try {
              if (job.useWorker) {
                await this.workerPool!.execute({
                  ...job,
                  INSTANCE_ID: `${WIKI.INSTANCE_ID}:WKR`
                })
              } else {
                await this.tasks![job.task](job.payload)
              }
              // -> Update job history (success)
              await WIKI.db
                .update(jobHistoryTable)
                .set({
                  state: 'completed',
                  completedAt: sql`now()`
                })
                .where(eq(jobHistoryTable.id, job.id))
              WIKI.logger.info(`Completed job ${job.id}: ${job.task}`)
              this.pubsubClient!.query(`SELECT pg_notify($1, $2)`, [
                'scheduler',
                JSON.stringify({
                  source: WIKI.INSTANCE_ID,
                  event: 'jobCompleted',
                  state: 'success',
                  id: job.id
                })
              ])
            } catch (err: any) {
              WIKI.logger.warn(`Failed to complete job ${job.id}: ${job.task} [ FAILED ]`)
              WIKI.logger.warn(err)
              // -> Update job history (fail)
              await WIKI.db
                .update(jobHistoryTable)
                .set({
                  attempt: job.retries + 1,
                  state: 'failed',
                  lastErrorMessage: err.message
                })
                .where(eq(jobHistoryTable.id, job.id))
              this.pubsubClient!.query(`SELECT pg_notify($1, $2)`, [
                'scheduler',
                JSON.stringify({
                  source: WIKI.INSTANCE_ID,
                  event: 'jobCompleted',
                  state: 'failed',
                  id: job.id,
                  errorMessage: err.message
                })
              ])
              // -> Reschedule for retry
              if (job.retries < job.maxRetries) {
                const backoffDelay = 2 ** job.retries * WIKI.config.scheduler.retryBackoff
                await trx.insert(jobsTable).values({
                  ...job,
                  retries: job.retries + 1,
                  waitUntil: new Date(
                    Temporal.Now.instant().add({ seconds: backoffDelay }).epochMilliseconds
                  ),
                  updatedAt: new Date()
                })
                WIKI.logger.warn(`Rescheduling new attempt for job ${job.id}: ${job.task}...`)
              }
            }
          }
        }
      })
    } catch (err: any) {
      WIKI.logger.warn(err)
      if (jobIds && jobIds.length > 0) {
        // -> The filter must name the table being updated: `jobs.id` here produced
        //    `UPDATE "jobHistory" ... WHERE "jobs"."id" IN (...)`, which postgres rejects with
        //    "missing FROM-clause entry", and the statement was not awaited so the rejection was
        //    lost. Interrupted jobs were therefore never recorded as such.
        await WIKI.db
          .update(jobHistoryTable)
          .set({
            state: 'interrupted',
            lastErrorMessage: err.message
          })
          .where(inArray(jobHistoryTable.id, jobIds))
      }
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
              // -> Add a maximum of 10 future iterations for a single task
              let addedFutureJobs = 0
              while (true) {
                try {
                  // FIXME: pre-existing bug — cron-parser v5's `next()` returns a `CronDate`, not an
                  // ES iterator result, so `next.value` and `next.done` below are both `undefined`.
                  // `next.value.getTime()` therefore throws (swallowed by the `catch { break }`)
                  // whenever `existingJobs` is non-empty, and `next.done` is never true so the loop
                  // only ever stops at the 10-iteration cap. Cast to `any` to keep the migration
                  // behavior-neutral; the fix is `next.getTime()` + `plannedIterations.hasNext()`.
                  const next = plannedIterations.next() as any
                  // -> Ensure this iteration isn't already scheduled
                  if (
                    !existingJobs.some(
                      (j: any) =>
                        j.task === job.task && j.waitUntil.getTime() === next.value.getTime()
                    )
                  ) {
                    // FIXME: `useWorker` is not an `addJob` option (it is derived inside `addJob`)
                    // and `waitUntil` is handed an ISO string rather than a Date. Cast preserves
                    // the existing call verbatim.
                    this.addJob({
                      task: job.task,
                      useWorker: !(typeof this.tasks![job.task] === 'function'),
                      payload: job.payload,
                      isScheduled: true,
                      waitUntil: next.toISOString(),
                      notify: false
                    } as any)
                    addedFutureJobs++
                    totalAdded++
                  }
                  // -> No more iterations for this period or max iterations count reached
                  if (next.done || addedFutureJobs >= 10) {
                    break
                  }
                } catch {
                  break
                }
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
