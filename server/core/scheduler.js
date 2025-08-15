const PgBoss = require('pg-boss')
const knexModule = require('./db')
const { isoDurationToCron } = require('../helpers/iso-duration-to-cron')
const { useClientDbPooling } = require('./db')

const schedulerUtils = require('./scheduler/scheduler-utils')
const jobRegistration = require('./scheduler/job-registration')
const schedulerConfig = require('./scheduler/scheduler-config')
const WorkerPool = require('./scheduler/worker-pool')
const path = require('path')

/* global WIKI */

class Scheduler {
  constructor() {
    this._registeredJobs = new Set()
    this.knex = null
    this.boss = null
    this.workerPool = null
  }

  async init() {
    WIKI.logger.debug('[scheduler] init() called')
    this.knex = knexModule.init().knex
    return this
  }

  async start() {
    WIKI.logger.debug('[scheduler] start() called')
    const { user, host, port, database, ssl } = this.knex.client.connectionSettings
    const password = WIKI.config.db.pass ? encodeURIComponent(WIKI.config.db.pass.toString()) : ''
    const connectionString = process.env.DATABASE_URL ||
      `postgres://${encodeURIComponent(user)}:${password}@${host}:${port || 5432}/${database}${ssl ? '?sslmode=require' : ''}`

    let bossOptions = { connectionString, schema: 'public' }
    const clientPoolUsed = useClientDbPooling()
    WIKI.logger.info(`[scheduler] Client Connection pool ${clientPoolUsed ? 'ENABLED' : 'DISABLED'} for PgBoss`)
    if (!clientPoolUsed) {
      bossOptions.max = 1 // Disable pooling for PgBoss if client pooling is not used. In that case pooling is managed by external service.
    }
    this.boss = new PgBoss(bossOptions)
    await this.boss.start()
    WIKI.logger.debug('[scheduler] PgBoss started')
    await this.knex.raw("CREATE INDEX IF NOT EXISTS idx_job_data_hash ON job ((data->>'hash'), state)")
    // Mask password in connection string for logging
    const maskedConnectionString = connectionString.replace(/(postgres:\/\/[^:]+:)[^@]+(@)/, '$1*****$2')
    WIKI.logger.debug(`[scheduler] Using connection string: ${maskedConnectionString}`)
    this.workerPool = new WorkerPool(path.join(__dirname, 'scheduler/worker.js'), schedulerUtils.getTotalNumberOfConcurrentWorkers(Scheduler.numberOfConcurrentWorkers))
    jobRegistration.registerStaticJobsFromConfig(WIKI, this.registerJob.bind(this))
  }

  async stop() {
    if (this.boss) await this.boss.stop()
    if (this.workerPool) await this.workerPool.close()
  }

  async registerJob(opts, data = {}) {
    const jobName = opts.name
    const hash = schedulerUtils.calculateHash(jobName, data)
    WIKI.logger.debug(`[scheduler] registerJob called for jobName: ${jobName}, opts:`, opts, 'data:', data)
    if (!this._registeredJobs.has(jobName)) {
      await this.ensureQueueExists(jobName)
      const numberOfConcurrentWorkers = Scheduler.numberOfConcurrentWorkers[jobName] || 1
      Scheduler.setupJobWorker(this.boss, this.knex, jobName, numberOfConcurrentWorkers, this.workerPool, opts.runInMainThread)
      this._registeredJobs.add(jobName)
    }
    if (await this.shouldSkipJob(opts, jobName, hash)) return
    if (opts.wait) return Scheduler.waitForJobCompletion(this.boss, jobName, data, hash, opts.runInMainThread)
    if (opts.repeat) await this.handleRepeatJob(opts, data, jobName, hash)
    if (opts.immediate) return this.handleImmediateJob(data, jobName, hash, opts.runInMainThread)
  }

  async ensureQueueExists(jobName) {
    let retries = schedulerConfig.SAFE_SEND_MAX_RETRIES
    while (retries > 0) {
      try {
        await this.boss.createQueue(jobName)
        WIKI.logger.debug(`[scheduler] Queue created for job ${jobName}`)
        break
      } catch (err) {
        if (err.message?.includes('deadlock detected') && retries > 1) {
          WIKI.logger.warn(`[scheduler] Deadlock detected while creating queue for job ${jobName}, retrying... (${schedulerConfig.SAFE_SEND_MAX_RETRIES + 1 - retries}/${schedulerConfig.SAFE_SEND_MAX_RETRIES})`)
          await new Promise(resolve => setTimeout(resolve, schedulerConfig.DELAY_MS_CREATE_QUEUE))
          retries--
        } else if (err.message?.includes('already exists')) {
          WIKI.logger.warn(`[scheduler] Queue table already exists for job ${jobName}, this is safe to ignore.`)
          break
        } else {
          WIKI.logger.warn(`[scheduler] createQueue failed for job ${jobName}: ${err.message}`)
          break
        }
      }
    }
  }

  async shouldSkipJob(opts, jobName, hash) {
    if ((opts.immediate || opts.wait) && (await schedulerUtils.isAnotherJobAlreadyQueued(this.knex, jobName, hash, WIKI.logger))) {
      WIKI.logger.info(`Task ${jobName} with hash ${hash} already has 2 jobs queued or running — discarded${opts.wait ? ' (wait)' : ''}`)
      return true
    }
    return false
  }

  async handleRepeatJob(opts, data, jobName, hash) {
    let cronExpr
    const scheduleType = schedulerUtils.getScheduleType(opts.schedule)
    if (scheduleType === 'duration') {
      cronExpr = isoDurationToCron(opts.schedule)
      if (!cronExpr) {
        throw new Error(`Unsupported ISO 8601 duration for schedule: ${opts.schedule}`)
      }
    } else if (scheduleType === 'cron') {
      cronExpr = opts.schedule
    }
    const options = { retentionHours: schedulerConfig.JOB_RETENTION_HOURS, expireInMinutes: Scheduler.activeJobExpirationMinutes }
    await this.boss.schedule(jobName, cronExpr, { data, hash, runInMainThread: opts.runInMainThread }, options)
    WIKI.logger.debug(`[scheduler] Scheduled repeating job ${jobName} with cron/interval: ${cronExpr}`)
  }

  async handleImmediateJob(data, jobName, hash, runInMainThread) {
    WIKI.logger.debug(`[scheduler] Publishing job ${jobName} with hash ${hash}`)
    const jobId = await schedulerUtils.safeSend(this.boss, jobName, { data, hash, runInMainThread }, WIKI.logger, Scheduler.activeJobExpirationMinutes)
    WIKI.logger.debug(`[scheduler] Published job ${jobName} with hash ${hash} (jobid: ${jobId})`)
    return jobId
  }

  static setupJobWorker(boss, knex, jobName, numberOfConcurrentWorkers, workerPool) {
    Scheduler.startConcurrentWorkers(boss, jobName, async job => {
      const jobData = job[0].data
      const hash = jobData.hash
      const runInMainThread = jobData.runInMainThread || false
      const decision = await schedulerUtils.getJobDecision(knex, jobName, hash, job[0].id)
      if (decision === schedulerUtils.JobDecision.SKIP) {
        WIKI.logger.info(`[scheduler] Skipping job ${jobName} with hash ${hash} because another job is already active and at least one is queued or retried.`)
        return
      }
      if (decision === schedulerUtils.JobDecision.REQUEUE) {
        WIKI.logger.info(`[scheduler] Re-queuing job ${jobName} with hash ${hash} because another job is already active.`)
        await schedulerUtils.safeSend(boss, jobName, jobData, WIKI.logger, Scheduler.activeJobExpirationMinutes, true)
        return
      }
      if (runInMainThread) {
        try {
          await require(`../jobs/${jobName}`)(jobData || {})
          return
        } catch (e) {
          WIKI.logger.error(`[scheduler] Main thread worker error for job ${jobName}: ${e.message}`)
        }
      }
      const result = await workerPool.runTask({ job: jobName, data: jobData.data || {} })
      if (!result.success) {
        WIKI.logger.error(`[scheduler] Worker error for job ${jobName}: ${result.error}`)
      }
    }, numberOfConcurrentWorkers)
  }

  static startConcurrentWorkers(boss, jobName, handler, numberOfConcurrentWorkers) {
    for (let i = 0; i < numberOfConcurrentWorkers; i++) {
      boss.work(jobName, { pollingIntervalSeconds: schedulerConfig.JOB_POLLING_INTERVAL_SECONDS }, handler)
    }
  }

  static async waitForJobCompletion(boss, jobName, data, hash, runInMainThread) {
    const jobId = await schedulerUtils.safeSend(boss, jobName, { data, hash, runInMainThread }, WIKI.logger, Scheduler.activeJobExpirationMinutes)
    WIKI.logger.debug(`[scheduler] Waiting for job ${jobName} (jobid: ${jobId}) to complete...`)
    const startWait = Date.now()
    while (Date.now() - startWait < schedulerConfig.DELAY_MS_WAIT_FOR_JOB_COMPLETION) {
      const job = await boss.getJobById(jobName, jobId)
      WIKI.logger.debug(`[scheduler] Polled jobid ${jobId}: state=${job ? job.state : 'not found'}`)
      if (!job) throw new Error('Job not found')
      if (job.state === 'completed') {
        return job.data
      }
      if (job.state === 'failed') throw new Error('Job failed')
      await new Promise(resolve => setTimeout(resolve, schedulerConfig.DELAY_MS_WAIT_FOR_JOB_POLL))
    }
    throw new Error('Timeout waiting for job completion')
  }

  static getActiveJobExpirationMinutes() {
    return process.env.SCHEDULER_ACTIVE_JOB_EXPIRATION_MINUTES !== undefined ?
      parseInt(process.env.SCHEDULER_ACTIVE_JOB_EXPIRATION_MINUTES, 10) :
      (WIKI.config.scheduler?.activeJobExpirationMinutes ?? schedulerConfig.DEFAULT_ACTIVE_JOB_EXPIRATION_MINUTES)
  }
}

Scheduler.numberOfConcurrentWorkers = {
  'rebuild-tree': process.env.SCHEDULER_CONCURRENT_WORKERS_REBUILD_TREE !== undefined ?
    parseInt(process.env.SCHEDULER_CONCURRENT_WORKERS_REBUILD_TREE, 10) :
    (WIKI.config.scheduler?.concurrentWorkers?.['rebuild-tree'] ?? schedulerConfig.DEFAULT_CONCURRENT_NUMBER_OF_WORKERS_FOR_REBUILD_TREE_JOB),

  'render-page': process.env.SCHEDULER_CONCURRENT_WORKERS_RENDER_PAGE !== undefined ?
    parseInt(process.env.SCHEDULER_CONCURRENT_WORKERS_RENDER_PAGE, 10) :
    (WIKI.config.scheduler?.concurrentWorkers?.['render-page'] ?? schedulerConfig.DEFAULT_CONCURRENT_NUMBER_OF_WORKERS_FOR_RENDER_PAGE_JOB),

  'sanitize-svg': process.env.SCHEDULER_CONCURRENT_WORKERS_SANITIZE_SVG !== undefined ?
    parseInt(process.env.SCHEDULER_CONCURRENT_WORKERS_SANITIZE_SVG, 10) :
    (WIKI.config.scheduler?.concurrentWorkers?.['sanitize-svg'] ?? schedulerConfig.DEFAULT_CONCURRENT_NUMBER_OF_WORKERS_FOR_SANITIZE_SVG_JOB),
  'anonymize-inactive-users-job': 1,
  'fetch-graph-locale': 1,
  'purge-uploads': 1,
  'sync-storage': 1,
  'purge-page-history': 1
  // Note: 'fetch-graph-locale', 'notify-users', 'sync-graph-locales', 'sync-graph-updates' and 'sync-storage' are not added here because they run in the main thread.
}

Scheduler.activeJobExpirationMinutes = Scheduler.getActiveJobExpirationMinutes()

module.exports = {
  async init() {
    return new Scheduler().init()
  },
  Scheduler
}
