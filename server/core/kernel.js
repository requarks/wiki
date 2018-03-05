const _ = require('lodash')
const cluster = require('cluster')
const Promise = require('bluebird')

/* global WIKI */

module.exports = {
  numWorkers: 1,
  workers: [],
  init() {
    if (cluster.isMaster) {
      WIKI.logger.info('=======================================')
      WIKI.logger.info('= WIKI.js =============================')
      WIKI.logger.info('=======================================')

      WIKI.redis = require('./redis').init()
      WIKI.queue = require('./queue').init()

      this.setWorkerLimit()
      this.bootMaster()
    } else {
      this.bootWorker()
    }
  },
  /**
   * Pre-Master Boot Sequence
   */
  preBootMaster() {
    return Promise.mapSeries([
      () => { return WIKI.db.onReady },
      () => { return WIKI.configSvc.loadFromDb() },
      () => { return WIKI.queue.clean() }
    ], fn => { return fn() })
  },
  /**
   * Boot Master Process
   */
  bootMaster() {
    this.preBootMaster().then(sequenceResults => {
      if (_.every(sequenceResults, rs => rs === true) && WIKI.config.configMode !== 'setup') {
        this.postBootMaster()
      } else {
        WIKI.logger.info('Starting configuration manager...')
        require('../setup')()
      }
      return true
    }).catch(err => {
      WIKI.logger.error(err)
      process.exit(1)
    })
  },
  /**
   * Post-Master Boot Sequence
   */
  async postBootMaster() {
    await require('../master')()

    _.times(this.numWorkers, () => {
      this.spawnWorker()
    })

    WIKI.queue.uplClearTemp.add({}, {
      repeat: { cron: '*/15 * * * *' }
    })

    cluster.on('exit', (worker, code, signal) => {
      if (!global.DEV) {
        WIKI.logger.info(`Background Worker #${worker.id} was terminated.`)
      }
    })
  },
  /**
   * Boot Worker Process
   */
  bootWorker() {
    WIKI.logger.info(`Background Worker #${cluster.worker.id} is initializing...`)
    require('../worker')
  },
  /**
   * Spawn new Worker process
   */
  spawnWorker() {
    this.workers.push(cluster.fork())
  },
  /**
   * Set Worker count based on config + system capabilities
   */
  setWorkerLimit() {
    const numCPUs = require('os').cpus().length
    this.numWorkers = (WIKI.config.workers > 0) ? WIKI.config.workers : numCPUs
    if (this.numWorkers > numCPUs) {
      this.numWorkers = numCPUs
    }
  }
}
