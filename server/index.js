'use strict'

// ===========================================
// Wiki.js
// Licensed under AGPLv3
// ===========================================

const path = require('path')
const cluster = require('cluster')

let wiki = {
  IS_DEBUG: process.env.NODE_ENV === 'development',
  IS_MASTER: cluster.isMaster,
  ROOTPATH: process.cwd(),
  SERVERPATH: path.join(process.cwd(), 'server'),
  configSvc: require('./modules/config')
}
global.wiki = wiki

process.env.VIPS_WARNING = false

// if (wiki.IS_DEBUG) {
//   require('@glimpse/glimpse').init()
// }

wiki.configSvc.init()

// ----------------------------------------
// Init Logger
// ----------------------------------------

wiki.logger = require('./modules/logger').init()

// ----------------------------------------
// Init DB
// ----------------------------------------

wiki.db = require('./modules/db').init()

// ----------------------------------------
// Start Cluster
// ----------------------------------------

const numCPUs = require('os').cpus().length
let numWorkers = (wiki.config.workers > 0) ? wiki.config.workers : numCPUs
if (numWorkers > numCPUs) {
  numWorkers = numCPUs
}

if (cluster.isMaster) {
  wiki.logger.info('=======================================')
  wiki.logger.info('= Wiki.js =============================')
  wiki.logger.info('=======================================')

  require('./master').then(() => {
    // -> Create background workers
    for (let i = 0; i < numWorkers; i++) {
      cluster.fork()
    }

    // -> Queue post-init tasks

    wiki.queue.uplClearTemp.add({}, {
      repeat: { cron: '*/15 * * * *' }
    })
  })

  cluster.on('exit', (worker, code, signal) => {
    wiki.logger.info(`Background Worker #${worker.id} was terminated.`)
  })
} else {
  wiki.logger.info(`Background Worker #${cluster.worker.id} is initializing...`)
  require('./worker')
}
