const cluster = require('cluster')
const Promise = require('bluebird')
const _ = require('lodash')

/* global wiki */

module.exports = {
  numWorkers: 1,
  workers: [],
  init() {
    if (cluster.isMaster) {
      wiki.logger.info('=======================================')
      wiki.logger.info('= Wiki.js =============================')
      wiki.logger.info('=======================================')

      wiki.redis = require('./redis').init()
      wiki.queue = require('./queue').init()

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
      () => { return wiki.db.onReady },
      () => { return wiki.configSvc.loadFromDb() },
      () => { return wiki.queue.clean() }
    ], fn => { return fn() })
  },
  /**
   * Boot Master Process
   */
  bootMaster() {
    this.preBootMaster().then(sequenceResults => {
      if (_.every(sequenceResults, rs => rs === true) && wiki.config.configMode !== 'setup') {
        this.postBootMaster()
      } else {
        wiki.logger.info('Starting configuration manager...')
        require('../setup')()
      }
      return true
    }).catch(err => {
      wiki.logger.error(err)
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

    wiki.queue.uplClearTemp.add({}, {
      repeat: { cron: '*/15 * * * *' }
    })

    cluster.on('exit', (worker, code, signal) => {
      if (!global.DEV) {
        wiki.logger.info(`Background Worker #${worker.id} was terminated.`)
      }
    })
  },
  /**
   * Boot Worker Process
   */
  bootWorker() {
    wiki.logger.info(`Background Worker #${cluster.worker.id} is initializing...`)
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
    this.numWorkers = (wiki.config.workers > 0) ? wiki.config.workers : numCPUs
    if (this.numWorkers > numCPUs) {
      this.numWorkers = numCPUs
    }
  }
}
