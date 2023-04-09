import { DynamicThreadPool } from 'poolifier'
import os from 'node:os'
import fs from 'node:fs/promises'
import path from 'node:path'
import cronparser from 'cron-parser'
import { DateTime } from 'luxon'
import { v4 as uuid } from 'uuid'
import { createDeferred } from '../helpers/common.mjs'
import { find, remove } from 'lodash-es'

export default {
  workerPool: null,
  maxWorkers: 1,
  activeWorkers: 0,
  pollingRef: null,
  scheduledRef: null,
  tasks: null,
  completionPromises: [],
  async init () {
    this.maxWorkers = WIKI.config.scheduler.workers === 'auto' ? (os.cpus().length - 1) : WIKI.config.scheduler.workers
    if (this.maxWorkers < 1) { this.maxWorkers = 1 }
    WIKI.logger.info(`Initializing Worker Pool (Limit: ${this.maxWorkers})...`)
    this.workerPool = new DynamicThreadPool(1, this.maxWorkers, path.join(WIKI.SERVERPATH, 'worker.mjs'), {
      errorHandler: (err) => WIKI.logger.warn(err),
      exitHandler: () => WIKI.logger.debug('A worker has gone offline.'),
      onlineHandler: () => WIKI.logger.debug('New worker is online.')
    })
    this.tasks = {}
    for (const f of (await fs.readdir(path.join(WIKI.SERVERPATH, 'tasks/simple')))) {
      const taskName = f.replace('.mjs', '')
      this.tasks[taskName] = (await import(path.join(WIKI.SERVERPATH, 'tasks/simple', f))).task
    }
    return this
  },
  async start () {
    WIKI.logger.info('Starting Scheduler...')

    // -> Add PostgreSQL Sub Channel
    WIKI.db.listener.addChannel('scheduler', async payload => {
      switch (payload.event) {
        case 'newJob': {
          if (this.activeWorkers < this.maxWorkers) {
            this.activeWorkers++
            await this.processJob()
            this.activeWorkers--
          }
          break
        }
        case 'jobCompleted': {
          const jobPromise = find(this.completionPromises, ['id', payload.id])
          if (jobPromise) {
            if (payload.state === 'success') {
              jobPromise.resolve()
            } else {
              jobPromise.reject(new Error(payload.errorMessage))
            }
            setTimeout(() => {
              remove(this.completionPromises, ['id', payload.id])
            })
          }
          break
        }
      }
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
  async addJob ({ task, payload = {}, waitUntil, maxRetries, isScheduled = false, notify = true, promise = false }) {
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
      await WIKI.db.knex('jobs')
        .insert({
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
        WIKI.db.listener.publish('scheduler', {
          source: WIKI.INSTANCE_ID,
          event: 'newJob',
          id: jobId
        })
      }
      return {
        id: jobId,
        ...promise && { promise: jobDefer.promise }
      }
    } catch (err) {
      WIKI.logger.warn(`Failed to add job to scheduler: ${err.message}`)
    }
  },
  async processJob () {
    let jobIds = []
    try {
      const availableWorkers = this.maxWorkers - this.activeWorkers
      if (availableWorkers < 1) {
        WIKI.logger.debug('All workers are busy. Cannot process more jobs at the moment.')
        return
      }

      await WIKI.db.knex.transaction(async trx => {
        const jobs = await trx('jobs')
          .whereIn('id', WIKI.db.knex.raw(`(SELECT id FROM jobs WHERE ("waitUntil" IS NULL OR "waitUntil" <= NOW()) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT ${availableWorkers})`))
          .returning('*')
          .del()
        if (jobs && jobs.length > 0) {
          for (const job of jobs) {
            WIKI.logger.info(`Processing new job ${job.id}: ${job.task}...`)
            // -> Add to Job History
            await WIKI.db.knex('jobHistory').insert({
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
            }).onConflict('id').merge({
              executedBy: WIKI.INSTANCE_ID,
              startedAt: new Date()
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
              await WIKI.db.knex('jobHistory').where({
                id: job.id
              }).update({
                state: 'completed',
                completedAt: new Date()
              })
              WIKI.logger.info(`Completed job ${job.id}: ${job.task}`)
              WIKI.db.listener.publish('scheduler', {
                source: WIKI.INSTANCE_ID,
                event: 'jobCompleted',
                state: 'success',
                id: job.id
              })
            } catch (err) {
              WIKI.logger.warn(`Failed to complete job ${job.id}: ${job.task} [ FAILED ]`)
              WIKI.logger.warn(err)
              // -> Update job history (fail)
              await WIKI.db.knex('jobHistory').where({
                id: job.id
              }).update({
                attempt: job.retries + 1,
                state: 'failed',
                lastErrorMessage: err.message
              })
              WIKI.db.listener.publish('scheduler', {
                source: WIKI.INSTANCE_ID,
                event: 'jobCompleted',
                state: 'failed',
                id: job.id,
                errorMessage: err.message
              })
              // -> Reschedule for retry
              if (job.retries < job.maxRetries) {
                const backoffDelay = (2 ** job.retries) * WIKI.config.scheduler.retryBackoff
                await trx('jobs').insert({
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
        WIKI.db.knex('jobHistory').whereIn('id', jobIds).update({
          state: 'interrupted',
          lastErrorMessage: err.message
        })
      }
    }
  },
  async addScheduled () {
    try {
      await WIKI.db.knex.transaction(async trx => {
        // -> Acquire lock
        const jobLock = await trx('jobLock')
          .where(
            'key',
            WIKI.db.knex('jobLock')
              .select('key')
              .where('key', 'cron')
              .andWhere('lastCheckedAt', '<=', DateTime.utc().minus({ minutes: 5 }).toISO())
              .forUpdate()
              .skipLocked()
              .limit(1)
          ).update({
            lastCheckedBy: WIKI.INSTANCE_ID,
            lastCheckedAt: DateTime.utc().toISO()
          })
        if (jobLock > 0) {
          WIKI.logger.info(`Scheduling future planned jobs...`)
          const scheduledJobs = await WIKI.db.knex('jobSchedule')
          if (scheduledJobs?.length > 0) {
            // -> Get existing scheduled jobs
            const existingJobs = await WIKI.db.knex('jobs').where('isScheduled', true)
            let totalAdded = 0
            for (const job of scheduledJobs) {
              // -> Get next planned iterations
              const plannedIterations = cronparser.parseExpression(job.cron, {
                startDate: DateTime.utc().toJSDate(),
                endDate: DateTime.utc().plus({ days: 1, minutes: 5 }).toJSDate(),
                iterator: true,
                tz: 'UTC'
              })
              // -> Add a maximum of 10 future iterations for a single task
              let addedFutureJobs = 0
              while (true) {
                try {
                  const next = plannedIterations.next()
                  // -> Ensure this iteration isn't already scheduled
                  if (!existingJobs.some(j => j.task === job.task && j.waitUntil.getTime() === next.value.getTime())) {
                    this.addJob({
                      task: job.task,
                      useWorker: !(typeof this.tasks[job.task] === 'function'),
                      payload: job.payload,
                      isScheduled: true,
                      waitUntil: next.value.toISOString(),
                      notify: false
                    })
                    addedFutureJobs++
                    totalAdded++
                  }
                  // -> No more iterations for this period or max iterations count reached
                  if (next.done || addedFutureJobs >= 10) { break }
                } catch (err) {
                  break
                }
              }
            }
            if (totalAdded > 0) {
              WIKI.logger.info(`Scheduled ${totalAdded} new future planned jobs: [ OK ]`)
            } else {
              WIKI.logger.info(`No new future planned jobs to schedule: [ OK ]`)
            }
          }
        }
      })
    } catch (err) {
      WIKI.logger.warn(err)
    }
  },
  async stop () {
    WIKI.logger.info('Stopping Scheduler...')
    clearInterval(this.scheduledRef)
    clearInterval(this.pollingRef)
    await this.workerPool.destroy()
    WIKI.logger.info('Scheduler: [ STOPPED ]')
  }
}
