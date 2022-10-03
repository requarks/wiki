const _ = require('lodash')
const EventEmitter = require('eventemitter2').EventEmitter2

let isShuttingDown = false

module.exports = {
  async init() {
    WIKI.logger.info('=======================================')
    WIKI.logger.info(`= Wiki.js ${_.padEnd(WIKI.version + ' ', 29, '=')}`)
    WIKI.logger.info('=======================================')
    WIKI.logger.info('Initializing...')

    WIKI.db = require('./db').init()

    try {
      await WIKI.db.onReady
      await WIKI.configSvc.loadFromDb()
      await WIKI.configSvc.applyFlags()
    } catch (err) {
      WIKI.logger.error('Database Initialization Error: ' + err.message)
      if (WIKI.IS_DEBUG) {
        WIKI.logger.error(err)
      }
      process.exit(1)
    }

    this.bootWeb()
  },
  /**
   * Pre-Web Boot Sequence
   */
  async preBootWeb() {
    try {
      WIKI.cache = require('./cache').init()
      WIKI.scheduler = await require('./scheduler').init()
      WIKI.servers = require('./servers')
      WIKI.events = {
        inbound: new EventEmitter(),
        outbound: new EventEmitter()
      }
      WIKI.extensions = require('./extensions')
      WIKI.asar = require('./asar')
    } catch (err) {
      WIKI.logger.error(err)
      process.exit(1)
    }
  },
  /**
   * Boot Web Process
   */
  async bootWeb() {
    try {
      await this.preBootWeb()
      await require('../web')()
      this.postBootWeb()
    } catch (err) {
      WIKI.logger.error(err)
      process.exit(1)
    }
  },
  /**
   * Post-Web Boot Sequence
   */
  async postBootWeb() {
    await WIKI.db.analytics.refreshProvidersFromDisk()
    await WIKI.db.authentication.refreshStrategiesFromDisk()
    await WIKI.db.commentProviders.refreshProvidersFromDisk()
    await WIKI.db.renderers.refreshRenderersFromDisk()
    await WIKI.db.storage.refreshTargetsFromDisk()

    await WIKI.extensions.init()

    await WIKI.auth.activateStrategies()
    await WIKI.db.commentProviders.initProvider()
    await WIKI.db.sites.reloadCache()
    await WIKI.db.storage.initTargets()

    await WIKI.db.subscribeToNotifications()
    await WIKI.scheduler.start()
  },
  /**
   * Graceful shutdown
   */
  async shutdown (devMode = false) {
    if (isShuttingDown) { return }
    isShuttingDown = true
    if (WIKI.servers) {
      await WIKI.servers.stopServers()
    }
    if (WIKI.scheduler) {
      await WIKI.scheduler.stop()
    }
    if (WIKI.models) {
      await WIKI.db.unsubscribeToNotifications()
      if (WIKI.db.knex) {
        await WIKI.db.knex.destroy()
      }
    }
    if (WIKI.asar) {
      await WIKI.asar.unload()
    }
    if (!devMode) {
      WIKI.logger.info('Terminating process...')
      process.exit(0)
    }
  }
}
