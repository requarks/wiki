// ===========================================
// Wiki.js
// Licensed under AGPLv3
// ===========================================

const path = require('path')

let WIKI = {
  IS_DEBUG: process.env.NODE_ENV === 'development',
  IS_MASTER: true,
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
  WIKI.logger.warn(err)
  WIKI.telemetry.sendError(err)
})
process.on('uncaughtException', (err) => {
  WIKI.logger.warn(err)
  WIKI.telemetry.sendError(err)
})

// ----------------------------------------
// Start Kernel
// ----------------------------------------

WIKI.kernel.init()
