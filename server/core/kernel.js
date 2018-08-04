/* global WIKI */

module.exports = {
  async init() {
    WIKI.logger.info('=======================================')
    WIKI.logger.info('= Wiki.js =============================')
    WIKI.logger.info('=======================================')

    WIKI.models = require('./db').init()
    WIKI.redis = require('./redis').init()
    WIKI.queue = require('./queue').init()

    await this.preBootMaster()
    this.bootMaster()
  },
  /**
   * Pre-Master Boot Sequence
   */
  async preBootMaster() {
    try {
      await WIKI.models.onReady
      await WIKI.configSvc.loadFromDb()
      await WIKI.queue.clean()
    } catch (err) {
      WIKI.logger.error(err)
      process.exit(1)
    }
  },
  /**
   * Boot Master Process
   */
  async bootMaster() {
    try {
      if (WIKI.config.setup) {
        WIKI.logger.info('Starting setup wizard...')
        require('../setup')()
      } else {
        await require('../master')()
        this.postBootMaster()
      }
    } catch (err) {
      WIKI.logger.error(err)
      process.exit(1)
    }
  },
  /**
   * Post-Master Boot Sequence
   */
  async postBootMaster() {
    await WIKI.models.authentication.refreshStrategiesFromDisk()
    await WIKI.auth.activateStrategies()
    await WIKI.models.storage.refreshTargetsFromDisk()
    await WIKI.queue.start()
  }
}
