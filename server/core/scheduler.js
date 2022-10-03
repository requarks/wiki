const { DynamicThreadPool } = require('poolifier')
const os = require('node:os')
const autoload = require('auto-load')
const path = require('node:path')
const cronparser = require('cron-parser')
const { DateTime } = require('luxon')

module.exports = {
  workerPool: null,
  maxWorkers: 1,
  activeWorkers: 0,
  pollingRef: null,
  scheduledRef: null,
  tasks: null,
  async init () {
    this.maxWorkers = WIKI.config.scheduler.workers === 'auto' ? os.cpus().length : WIKI.config.scheduler.workers
    WIKI.logger.info(`Initializing Worker Pool (Limit: ${this.maxWorkers})...`)
    this.workerPool = new DynamicThreadPool(1, this.maxWorkers, './server/worker.js', {
      errorHandler: (err) => WIKI.logger.warn(err),
      exitHandler: () => WIKI.logger.debug('A worker has gone offline.'),
      onlineHandler: () => WIKI.logger.debug('New worker is online.')
    })
    this.tasks = autoload(path.join(WIKI.SERVERPATH, 'tasks/simple'))
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
  async addJob ({ task, payload, waitUntil, isScheduled = false, notify = true }) {
    try {
      await WIKI.db.knex('jobs').insert({
        task,
        useWorker: !(typeof this.tasks[task] === 'function'),
        payload,
        isScheduled,
        waitUntil,
        createdBy: WIKI.INSTANCE_ID
      })
      if (notify) {
        WIKI.db.listener.publish('scheduler', {
          source: WIKI.INSTANCE_ID,
          event: 'newJob'
        })
      }
    } catch (err) {
      WIKI.logger.warn(`Failed to add job to scheduler: ${err.message}`)
    }
  },
  async processJob () {
    try {
      await WIKI.db.knex.transaction(async trx => {
        const jobs = await trx('jobs')
          .where('id', WIKI.db.knex.raw('(SELECT id FROM jobs WHERE ("waitUntil" IS NULL OR "waitUntil" <= NOW()) ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1)'))
          .returning('*')
          .del()
        if (jobs && jobs.length === 1) {
          const job = jobs[0]
          WIKI.logger.info(`Processing new job ${job.id}: ${job.task}...`)
          if (job.useWorker) {
            await this.workerPool.execute({
              id: job.id,
              name: job.task,
              data: job.payload
            })
          } else {
            await this.tasks[job.task](job.payload)
          }
        }
      })
    } catch (err) {
      WIKI.logger.warn(err)
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
                  }
                  // -> No more iterations for this period or max iterations count reached
                  if (next.done || addedFutureJobs >= 10) { break }
                } catch (err) {
                  break
                }
              }
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
