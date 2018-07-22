require('../core/worker')

/* global WIKI */

module.exports = async (job) => {
  WIKI.logger.info(`Syncing with storage provider ${job.data.target.title}...`)

  try {
    const target = require(`../modules/storage/${job.data.target.key}/storage.js`)
    target[job.data.event].call({
      config: job.data.target.config,
      mode: job.data.target.mode,
      page: job.data.page
    })
    WIKI.logger.info(`Syncing with storage provider ${job.data.target.title}: [ COMPLETED ]`)
  } catch (err) {
    WIKI.logger.error(`Syncing with storage provider ${job.data.target.title}: [ FAILED ]`)
    WIKI.logger.error(err.message)
  }
}
