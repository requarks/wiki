// ===========================================
// Wiki.js
// Licensed under AGPLv3
// ===========================================

const path = require('path')
const cluster = require('cluster')

let WIKI = {
  IS_DEBUG: process.env.NODE_ENV === 'development',
  IS_MASTER: cluster.isMaster,
  ROOTPATH: process.cwd(),
  SERVERPATH: path.join(process.cwd(), 'server'),
  Error: require('./helpers/error'),
  configSvc: require('./core/config'),
  kernel: require('./core/kernel')
}
global.WIKI = WIKI

WIKI.configSvc.init()

// ----------------------------------------
// Init Logger
// ----------------------------------------

WIKI.logger = require('./core/logger').init('MASTER')

// ----------------------------------------
// Init Telemetry
// ----------------------------------------

WIKI.telemetry = require('./core/telemetry').init()

process.on('unhandledRejection', (err) => {
  WIKI.telemetry.sendError(err)
})
process.on('uncaughtException', (err) => {
  WIKI.telemetry.sendError(err)
})

// ----------------------------------------
// Init DB
// ----------------------------------------

WIKI.db = require('./core/db').init()

// ----------------------------------------
// Start Kernel
// ----------------------------------------

WIKI.kernel.init()
