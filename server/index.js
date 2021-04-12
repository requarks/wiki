// ===========================================
// Wiki.js
// Licensed under AGPLv3
// ===========================================

const path = require('path')
const { nanoid } = require('nanoid')
const { DateTime } = require('luxon')

let WIKI = {
  IS_DEBUG: process.env.NODE_ENV === 'development',
  IS_MASTER: true,
  ROOTPATH: process.cwd(),
  INSTANCE_ID: nanoid(10),
  SERVERPATH: path.join(process.cwd(), 'server'),
  Error: require('./helpers/error'),
  configSvc: require('./core/config'),
  kernel: require('./core/kernel'),
  startedAt: DateTime.utc()
}
global.WIKI = WIKI

WIKI.configSvc.init()

// ----------------------------------------
// Init Logger
// ----------------------------------------

WIKI.logger = require('./core/logger').init('MASTER')

// ----------------------------------------
// Start Kernel
// ----------------------------------------

WIKI.kernel.init()

// ----------------------------------------
// Register exit handler
// ----------------------------------------

process.on('SIGINT', () => {
  WIKI.kernel.shutdown()
})
process.on('message', (msg) => {
  if (msg === 'shutdown') {
    WIKI.kernel.shutdown()
  }
})
