'use strict'

// ===========================================
// Wiki.js
// Licensed under AGPLv3
// ===========================================

const path = require('path')
let wiki = {
  IS_DEBUG: process.env.NODE_ENV === 'development',
  ROOTPATH: process.cwd(),
  SERVERPATH: path.join(process.cwd(), 'server')
}
global.wiki = wiki

process.env.VIPS_WARNING = false

// if (wiki.IS_DEBUG) {
//   require('@glimpse/glimpse').init()
// }

let appconf = require('./modules/config')()
wiki.config = appconf.config
wiki.data = appconf.data

// ----------------------------------------
// Load Winston
// ----------------------------------------

wiki.logger = require('./modules/logger')()

// ----------------------------------------
// Start Cluster
// ----------------------------------------

const cluster = require('cluster')
const numCPUs = require('os').cpus().length

if (cluster.isMaster) {
  wiki.logger.info('Wiki.js is initializing...')

  require('./master')

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork()
  }

  cluster.on('exit', (worker, code, signal) => {
    wiki.logger.info(`Worker #${worker.id} died.`)
  })
} else {
  wiki.logger.info(`Background Worker #${cluster.worker.id} is starting...`)
  // require('./worker')
}
