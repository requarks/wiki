const moment = require('moment')
const childProcess = require('child_process')
const _ = require('lodash')
const configHelper = require('../helpers/config')

/* global WIKI */

// Bounded concurrency for forked worker jobs: each fork is a full Node process
// with its own DB pool. Unlimited forks can exhaust process/fd limits (EAGAIN).
const MAX_CONCURRENT_WORKERS = 3
const WORKER_TIMEOUT_MS = 10 * 60 * 1000
let activeWorkers = 0
const workerQueue = []

function acquireWorkerSlot () {
  if (activeWorkers < MAX_CONCURRENT_WORKERS) {
    activeWorkers++
    return Promise.resolve()
  }
  return new Promise(resolve => {
    workerQueue.push(resolve)
  })
}

function releaseWorkerSlot () {
  const next = workerQueue.shift()
  if (next) {
    next()
  } else {
    activeWorkers--
  }
}

class Job {
  constructor({
    name,
    immediate = false,
    schedule = 'P1D',
    repeat = false,
    worker = false
  }, queue) {
    this.queue = queue
    this.finished = Promise.resolve()
    this.name = name
    this.immediate = immediate
    this.schedule = moment.duration(schedule)
    this.repeat = repeat
    this.worker = worker
  }

  /**
   * Start Job
   *
   * @param {Object} data Job Data
   */
  start(data) {
    this.queue.jobs.push(this)
    if (this.immediate) {
      this.invoke(data)
    } else {
      this.enqueue(data)
    }
  }

  /**
   * Queue the next job run according to the wait duration
   *
   * @param {Object} data Job Data
   */
  enqueue(data) {
    this.timeout = setTimeout(this.invoke.bind(this), this.schedule.asMilliseconds(), data)
  }

  /**
   * Run the actual job
   *
   * @param {Object} data Job Data
   */
  async invoke(data) {
    try {
      if (this.worker) {
        await acquireWorkerSlot()
        const proc = childProcess.fork(`server/core/worker.js`, [
          `--job=${this.name}`,
          `--data=${data}`
        ], {
          cwd: WIKI.ROOTPATH,
          stdio: ['inherit', 'inherit', 'pipe', 'ipc']
        })
        const stderr = []
        proc.stderr.on('data', chunk => stderr.push(chunk))
        const killTimer = setTimeout(() => {
          WIKI.logger.warn(`Job ${this.name} exceeded the ${WORKER_TIMEOUT_MS / 1000}s timeout and will be terminated.`)
          proc.kill('SIGKILL')
        }, WORKER_TIMEOUT_MS)
        this.finished = new Promise((resolve, reject) => {
          proc.on('exit', (code, signal) => {
            clearTimeout(killTimer)
            releaseWorkerSlot()
            const data = Buffer.concat(stderr).toString()
            if (code === 0) {
              resolve(data)
            } else {
              const err = new Error(`Error when running job ${this.name}: ${data}`)
              err.exitSignal = signal
              err.exitCode = code
              err.stderr = data
              reject(err)
            }
            proc.kill()
          })
        })
      } else {
        this.finished = require(`../jobs/${this.name}`)(data)
      }
      await this.finished
    } catch (err) {
      WIKI.logger.warn(err)
    }
    if (this.repeat && this.queue.jobs.includes(this)) {
      this.enqueue(data)
    } else {
      this.stop().catch(() => {})
    }
  }

  /**
   * Stop any future job invocation from occuring
   */
  async stop() {
    clearTimeout(this.timeout)
    this.queue.jobs = this.queue.jobs.filter(x => x !== this)
    return this.finished
  }
}

module.exports = {
  jobs: [],
  init() {
    return this
  },
  start() {
    _.forOwn(WIKI.data.jobs, (queueParams, queueName) => {
      if (WIKI.config.offline && queueParams.offlineSkip) {
        WIKI.logger.warn(`Skipping job ${queueName} because offline mode is enabled. [SKIPPED]`)
        return
      }

      const schedule = (configHelper.isValidDurationString(queueParams.schedule)) ? queueParams.schedule : 'P1D'
      this.registerJob({
        name: _.kebabCase(queueName),
        immediate: _.get(queueParams, 'onInit', false),
        schedule: schedule,
        repeat: _.get(queueParams, 'repeat', false),
        worker: _.get(queueParams, 'worker', false)
      })
    })
  },
  registerJob(opts, data) {
    const job = new Job(opts, this)
    job.start(data)
    return job
  },
  async stop() {
    return Promise.all(this.jobs.map(job => job.stop()))
  }
}
