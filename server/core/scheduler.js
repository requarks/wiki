const moment = require('moment')
const childProcess = require('child_process')
const _ = require('lodash')
const configHelper = require('../helpers/config')

/* global WIKI */

class Job {
  constructor({
    name,
    immediate = false,
    schedule = 'P1D',
    repeat = false,
    worker = false
  }) {
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
    if (this.immediate) {
      this.invoke(data)
    } else {
      this.queue(data)
    }
  }

  /**
   * Queue the next job run according to the wait duration
   *
   * @param {Object} data Job Data
   */
  queue(data) {
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
        const proc = childProcess.fork(`server/core/worker.js`, [
          `--job=${this.name}`,
          `--data=${data}`
        ], {
          cwd: WIKI.ROOTPATH
        })
        this.finished = new Promise((resolve, reject) => {
          proc.on('exit', (code, signal) => {
            if (code === 0) {
              resolve()
            } else {
              reject(signal)
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
    if (this.repeat) {
      this.queue(data)
    }
  }

  /**
   * Stop any future job invocation from occuring
   */
  stop() {
    clearTimeout(this.timeout)
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
    const job = new Job(opts)
    job.start(data)
    if (job.repeat) {
      this.jobs.push(job)
    }
    return job
  },
  stop() {
    this.jobs.forEach(job => {
      job.stop()
    })
  }
}
