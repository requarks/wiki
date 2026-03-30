import { DynamicThreadPool } from 'poolifier'
import os from 'node:os'
import fs from 'node:fs/promises'
import path from 'node:path'
import { CronExpressionParser } from 'cron-parser'
import { DateTime } from 'luxon'
import { v4 as uuid } from 'uuid'
import { createDeferred } from '../helpers/common.js'
import { camelCase } from 'es-toolkit/string'
import { remove } from 'es-toolkit/array'
import {
  jobs as jobsTable,
  jobLock as jobLockTable,
  jobSchedule as jobScheduleTable,
  jobHistory as jobHistoryTable
} from '../db/schema.js'
import { eq, inArray, sql } from 'drizzle-orm'

export default {
  workerPool: null,
  pubsubClient: null,
  maxWorkers: 1,
  activeWorkers: 0,
  pollingRef: null,
  scheduledRef: null,
  tasks: null,
  completionPromises: [],
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
      path.join(WIKI.SERVERPATH, 'worker.js'),
      {
        errorHandler: (err) => WIKI.logger.warn(err),
        exitHandler: () => WIKI.logger.debug('A worker has gone offline.'),
        onlineHandler: () => WIKI.logger.debug('New worker is online.')
      }
    )
    this.tasks = {}
    for (const f of await fs.readdir(path.join(WIKI.SERVERPATH, 'tasks/simple'))) {
      const taskName = camelCase(f.replace('.js', ''))
      this.tasks[taskName] = (await import(path.join(WIKI.SERVERPATH, 'tasks/simple', f))).task
    }
    return this
  },
  async start() {
    WIKI.logger.info('Starting Scheduler...')

    const connectionAppName = `Wiki.js - ${WIKI.INSTANCE_ID}:SCHEDULER`
    this.pubsubClient = await WIKI.dbManager.pool.connect()
    await this.pubsubClient.query(`SET application_name = '${connectionAppName}'`)

    // -> Outbound events handling

    this.pubsubClient.query('LISTEN scheduler')
    this.pubsubClient.on('notification', async (msg) => {
      if (msg.channel !== 'scheduler') {
        return
      }
      try {
        const decoded = JSON.parse(msg.payload)
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
   * @param {Object} opts - Job options
   * @param {string} opts.task - The task name to execute.
   * @param {Object} [opts.payload={}] - An optional data object to pass to the job.
   * @param {Date} [opts.waitUntil] - An optional datetime after which the task is allowed to run.
   * @param {Number} [opts.maxRetries] - The number of times this job can be restarted upon failure. Uses server defaults if not provided.
   * @param {Boolean} [opts.isScheduled=false] - Whether this is a scheduled job.
   * @param {Boolean} [opts.notify=true] - Whether to notify all instances that a new job is available.
   * @param {Boolean} [opts.promise=false] - Whether to return a promise property that resolves when the job completes.
   * @returns {Promise}
   */
  async addJob({
    task,
    payload = {},
    waitUntil,
    maxRetries,
    isScheduled = false,
    notify = true,
    promise = false
  }) {
    try {
      const jobId = uuid()
      const jobDefer = createDeferred()
      if (promise) {
        this.completionPromises.push({
          id: jobId,
          added: DateTime.utc(),
          resolve: jobDefer.resolve,
          reject: jobDefer.reject
        })
      }
      await WIKI.db.insert(jobsTable).values({
        id: jobId,
        task,
        useWorker: !(typeof this.tasks[task] === 'function'),
        payload,
        maxRetries: maxRetries ?? WIKI.config.scheduler.maxRetries,
        isScheduled,
        waitUntil,
        createdBy: WIKI.INSTANCE_ID
      })
      if (notify) {
        this.pubsubClient.query(`SELECT pg_notify($1, $2)`, [
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
    } catch (err) {
      WIKI.logger.warn(`Failed to add job to scheduler: ${err.message}`)
    }
  },
  async processJob() {
    const jobIds = []
    try {
      const availableWorkers = this.maxWorkers - this.activeWorkers
      if (availableWorkers < 1) {
        WIKI.logger.debug('All workers are busy. Cannot process more jobs at the moment.')
        return
      }

      await WIKI.db.transaction(async (trx) => {
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
                await this.workerPool.execute({
                  ...job,
                  INSTANCE_ID: `${WIKI.INSTANCE_ID}:WKR`
                })
              } else {
                await this.tasks[job.task](job.payload)
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
              this.pubsubClient.query(`SELECT pg_notify($1, $2)`, [
                'scheduler',
                JSON.stringify({
                  source: WIKI.INSTANCE_ID,
                  event: 'jobCompleted',
                  state: 'success',
                  id: job.id
                })
              ])
            } catch (err) {
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
              this.pubsubClient.query(`SELECT pg_notify($1, $2)`, [
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
                  waitUntil: DateTime.utc().plus({ seconds: backoffDelay }).toJSDate(),
                  updatedAt: new Date()
                })
                WIKI.logger.warn(`Rescheduling new attempt for job ${job.id}: ${job.task}...`)
              }
            }
          }
        }
      })
    } catch (err) {
      WIKI.logger.warn(err)
      if (jobIds && jobIds.length > 0) {
        WIKI.db
          .update(jobHistoryTable)
          .set({
            state: 'interrupted',
            lastErrorMessage: err.message
          })
          .where(inArray(jobsTable.id, jobIds))
      }
    }
  },
  async addScheduled() {
    try {
      await WIKI.db.transaction(async (trx) => {
        // -> Acquire lock
        const jobLock = await trx
          .update(jobLockTable)
          .set({
            lastCheckedBy: WIKI.INSTANCE_ID,
            lastCheckedAt: DateTime.utc().toISO()
          })
          .where(
            eq(
              jobLockTable.key,
              sql`(SELECT "jobLock"."key" FROM "jobLock" WHERE "jobLock"."key" = 'cron' AND "jobLock"."lastCheckedAt" <= ${DateTime.utc().minus({ minutes: 5 }).toISO()} FOR UPDATE SKIP LOCKED LIMIT 1)`
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
                startDate: DateTime.utc().toISO(),
                endDate: DateTime.utc().plus({ days: 1, minutes: 5 }).toISO(),
                tz: 'UTC'
              })
              // -> Add a maximum of 10 future iterations for a single task
              let addedFutureJobs = 0
              while (true) {
                try {
                  const next = plannedIterations.next()
                  // -> Ensure this iteration isn't already scheduled
                  if (
                    !existingJobs.some(
                      (j) => j.task === job.task && j.waitUntil.getTime() === next.value.getTime()
                    )
                  ) {
                    this.addJob({
                      task: job.task,
                      useWorker: !(typeof this.tasks[job.task] === 'function'),
                      payload: job.payload,
                      isScheduled: true,
                      waitUntil: next.toISOString(),
                      notify: false
                    })
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
    } catch (err) {
      WIKI.logger.warn(err)
    }
  },
  async stop() {
    WIKI.logger.info('Stopping Scheduler...')
    clearInterval(this.scheduledRef)
    clearInterval(this.pollingRef)
    await this.workerPool.destroy()
    WIKI.logger.info('Scheduler: [ STOPPED ]')
  }
}
