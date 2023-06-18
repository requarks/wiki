import { padEnd } from 'lodash-es'
import eventemitter2 from 'eventemitter2'
import NodeCache from 'node-cache'

import asar from './asar.mjs'
import db from './db.mjs'
import extensions from './extensions.mjs'
import scheduler from './scheduler.mjs'
import servers from './servers.mjs'

let isShuttingDown = false

export default {
  async init() {
    WIKI.logger.info('=======================================')
    WIKI.logger.info(`= Wiki.js ${padEnd(WIKI.version + ' ', 29, '=')}`)
    WIKI.logger.info('=======================================')
    WIKI.logger.info('Initializing...')
    WIKI.logger.info(`Running node.js ${process.version}`)

    WIKI.db = await db.init()

    try {
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
      WIKI.cache = new NodeCache({ checkperiod: 0 })
      WIKI.scheduler = await scheduler.init()
      WIKI.servers = servers
      WIKI.events = {
        inbound: new eventemitter2.EventEmitter2(),
        outbound: new eventemitter2.EventEmitter2()
      }
      WIKI.extensions = extensions
      WIKI.asar = asar
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
      await (await import('../web.mjs')).init()
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
    await WIKI.db.locales.refreshFromDisk()

    await WIKI.db.analytics.refreshProvidersFromDisk()
    await WIKI.db.authentication.refreshStrategiesFromDisk()
    await WIKI.db.commentProviders.refreshProvidersFromDisk()
    await WIKI.db.renderers.refreshRenderersFromDisk()
    await WIKI.db.storage.refreshTargetsFromDisk()

    await WIKI.extensions.init()

    await WIKI.auth.activateStrategies()
    await WIKI.db.commentProviders.initProvider()
    await WIKI.db.locales.reloadCache()
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
