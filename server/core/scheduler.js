const PgBoss = require('pg-boss')
const knexModule = require('./db')
const configHelper = require('../helpers/config')
const { isoDurationToCron } = require('../helpers/iso-duration-to-cron')
const { useClientDbPooling } = require('./db')

const schedulerUtils = require('./scheduler/scheduler-utils')
const workerRunner = require('./scheduler/worker-runner')
const jobRegistration = require('./scheduler/job-registration')
const schedulerConfig = require('./scheduler/scheduler-config')

/* global WIKI */
class Scheduler {
  constructor() {
    this._registeredJobs = new Set()
    this.knex = null
    this.boss = null
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
    // Mask password in connection string for logging
    const maskedConnectionString = connectionString.replace(/(postgres:\/\/[^:]+:)[^@]+(@)/, '$1*****$2')
    WIKI.logger.debug(`[scheduler] Using connection string: ${maskedConnectionString}`)
    jobRegistration.registerStaticJobsFromConfig(WIKI, this.registerJob.bind(this))
  }

  async stop() {
    if (this.boss) await this.boss.stop()
  }

  async registerJob(opts, data = {}) {
    const jobName = opts.name
    const hash = schedulerUtils.calculateHash(jobName, data)
    WIKI.logger.debug(`[scheduler] registerJob called for jobName: ${jobName}, opts:`, opts, 'data:', data)
    if (!this._registeredJobs.has(jobName)) {
      await this.ensureQueueExists(jobName)
      const numberOfConcurrentWorkers = Scheduler.numberOfConcurrentWorkers[jobName] || 1
      Scheduler.setupJobWorker(this.boss, this.knex, jobName, numberOfConcurrentWorkers)
      this._registeredJobs.add(jobName)
    }
    if (await this.shouldSkipJob(opts, jobName, hash)) return
    if (opts.wait) return Scheduler.waitForJobCompletion(this.boss, jobName, data, hash)
    if (opts.repeat) await this.handleRepeatJob(opts, data, jobName, hash)
    if (opts.immediate) return this.handleImmediateJob(data, jobName, hash)
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
    let cronExpr = opts.schedule
    if (configHelper.isValidDurationString(opts.schedule)) {
      cronExpr = isoDurationToCron(opts.schedule)
      if (!cronExpr) {
        throw new Error(`Unsupported ISO 8601 duration for schedule: ${opts.schedule}`)
      }
    }
    await this.boss.schedule(jobName, cronExpr, { data, hash })
    WIKI.logger.debug(`[scheduler] Scheduled repeating job ${jobName} with cron/interval: ${cronExpr}`)
  }

  async handleImmediateJob(data, jobName, hash) {
    WIKI.logger.debug(`[scheduler] Publishing job ${jobName} with hash ${hash}`)
    const jobId = await schedulerUtils.safeSend(this.boss, jobName, { data, hash }, WIKI.logger)
    WIKI.logger.debug(`[scheduler] Published job ${jobName} with hash ${hash} (jobid: ${jobId})`)
    return jobId
  }

  static setupJobWorker(boss, knex, jobName, numberOfConcurrentWorkers) {
    Scheduler.startConcurrentWorkers(boss, jobName, async job => {
      const jobData = job[0].data
      const hash = jobData.hash
      const decision = await schedulerUtils.getJobDecision(knex, jobName, hash, job[0].id)
      if (decision === schedulerUtils.JobDecision.SKIP) {
        WIKI.logger.info(`[scheduler] Skipping job ${jobName} with hash ${hash} because another job is already active and at least one is queued or retried.`)
        return
      }
      if (decision === schedulerUtils.JobDecision.REQUEUE) {
        WIKI.logger.info(`[scheduler] Re-queuing job ${jobName} with hash ${hash} because another job is already active.`)
        await schedulerUtils.safeSend(boss, jobName, jobData, WIKI.logger, true)
        return
      }
      const args = [`--job=${jobName}`]
      if (jobData?.data && !(typeof jobData.data === 'object' && Object.keys(jobData.data).length === 0)) {
        args.push(`--data=${JSON.stringify(jobData.data)}`)
      }
      await workerRunner.runWorkerProcess(jobName, args, WIKI.ROOTPATH, WIKI.logger)
    }, numberOfConcurrentWorkers)
  }

  static startConcurrentWorkers(boss, jobName, handler, numberOfConcurrentWorkers) {
    for (let i = 0; i < numberOfConcurrentWorkers; i++) {
      boss.work(jobName, { pollingIntervalSeconds: schedulerConfig.JOB_POLLING_INTERVAL_SECONDS }, handler)
    }
  }

  static async waitForJobCompletion(boss, jobName, data, hash) {
    const jobId = await schedulerUtils.safeSend(boss, jobName, { data, hash }, WIKI.logger)
    WIKI.logger.debug(`[scheduler] Waiting for job ${jobName} (jobid: ${jobId}) to complete...`)
    const start = Date.now()
    while (Date.now() - start < schedulerConfig.DELAY_MS_WAIT_FOR_JOB_COMPLETION) {
      const job = await boss.getJobById(jobName, jobId)
      WIKI.logger.debug(`[scheduler] Polled jobid ${jobId}: state=${job ? job.state : 'not found'}`)
      if (!job) throw new Error('Job not found')
      if (job.state === 'completed') return job.data
      if (job.state === 'failed') throw new Error('Job failed')
      await new Promise(resolve => setTimeout(resolve, schedulerConfig.DELAY_MS_WAIT_FOR_JOB_POLL))
    }
    throw new Error('Timeout waiting for job completion')
  }
}

Scheduler.numberOfConcurrentWorkers = {
  'rebuild-tree': process.env.SCHEDULER_CONCURRENT_WORKERS_REBUILD_TREE !== undefined ?
    parseInt(process.env.SCHEDULER_CONCURRENT_WORKERS_REBUILD_TREE, 10) :
    (WIKI.config.scheduler?.concurrentWorkers?.['rebuild-tree'] ?? 3),

  'render-page': process.env.SCHEDULER_CONCURRENT_WORKERS_RENDER_PAGE !== undefined ?
    parseInt(process.env.SCHEDULER_CONCURRENT_WORKERS_RENDER_PAGE, 10) :
    (WIKI.config.scheduler?.concurrentWorkers?.['render-page'] ?? 3),

  'sanitize-svg': process.env.SCHEDULER_CONCURRENT_WORKERS_SANITIZE_SVG !== undefined ?
    parseInt(process.env.SCHEDULER_CONCURRENT_WORKERS_SANITIZE_SVG, 10) :
    (WIKI.config.scheduler?.concurrentWorkers?.['sanitize-svg'] ?? 3)
}

module.exports = {
  async init() {
    return new Scheduler().init()
  },
  Scheduler
}
