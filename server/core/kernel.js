const _ = require('lodash')
const EventEmitter = require('events')

/* global WIKI */

module.exports = {
  async init() {
    WIKI.logger.info('=======================================')
    WIKI.logger.info(`= Wiki.js ${_.padEnd(WIKI.version + ' ', 29, '=')}`)
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
      WIKI.events = new EventEmitter()
      WIKI.redisSub = require('./redis').subscribe()
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
        await this.initTelemetry()
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
    await WIKI.models.editors.refreshEditorsFromDisk()
    await WIKI.models.loggers.refreshLoggersFromDisk()
    await WIKI.models.renderers.refreshRenderersFromDisk()
    await WIKI.models.searchEngines.refreshSearchEnginesFromDisk()
    await WIKI.models.storage.refreshTargetsFromDisk()

    await WIKI.auth.activateStrategies()
    await WIKI.queue.start()
  },
  /**
   * Init Telemetry
   */
  async initTelemetry() {
    require('./telemetry').init()

    process.on('unhandledRejection', (err) => {
      WIKI.logger.warn(err)
      WIKI.telemetry.sendError(err)
    })
    process.on('uncaughtException', (err) => {
      WIKI.logger.warn(err)
      WIKI.telemetry.sendError(err)
    })
  }
}
