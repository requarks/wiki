const _ = require('lodash')
const EventEmitter = require('eventemitter2').EventEmitter2

/* global WIKI */

module.exports = {
  async init() {
    WIKI.logger.info('=======================================')
    WIKI.logger.info(`= Wiki.js ${_.padEnd(WIKI.version + ' ', 29, '=')}`)
    WIKI.logger.info('=======================================')
    WIKI.logger.info('Initializing...')

    WIKI.models = require('./db').init()

    try {
      await WIKI.models.onReady
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
      WIKI.sideloader = await require('./sideloader').init()
      WIKI.cache = require('./cache').init()
      WIKI.scheduler = require('./scheduler').init()
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
    await WIKI.models.analytics.refreshProvidersFromDisk()
    await WIKI.models.authentication.refreshStrategiesFromDisk()
    await WIKI.models.commentProviders.refreshProvidersFromDisk()
    await WIKI.models.renderers.refreshRenderersFromDisk()
    await WIKI.models.storage.refreshTargetsFromDisk()

    await WIKI.extensions.init()

    await WIKI.auth.activateStrategies()
    await WIKI.models.commentProviders.initProvider()
    await WIKI.models.sites.reloadCache()
    await WIKI.models.storage.initTargets()
    // WIKI.scheduler.start()

    await WIKI.models.subscribeToNotifications()
  },
  /**
   * Graceful shutdown
   */
  async shutdown (devMode = false) {
    if (WIKI.servers) {
      await WIKI.servers.stopServers()
    }
    if (WIKI.scheduler) {
      await WIKI.scheduler.stop()
    }
    if (WIKI.models) {
      await WIKI.models.unsubscribeToNotifications()
      if (WIKI.models.knex) {
        await WIKI.models.knex.destroy()
      }
    }
    if (WIKI.asar) {
      await WIKI.asar.unload()
    }
    if (!devMode) {
      process.exit(0)
    }
  }
}
