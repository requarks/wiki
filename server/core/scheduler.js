const Job = require('./job')
const _ = require('lodash')

/* global WIKI */

module.exports = {
  jobs: [],
  init() {
    return this
  },
  start() {
    _.forOwn(WIKI.data.jobs, (queueParams, queueName) => {
      this.registerJob({
        name: _.kebabCase(queueName),
        immediate: queueParams.onInit,
        schedule: queueParams.schedule,
        repeat: true
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
