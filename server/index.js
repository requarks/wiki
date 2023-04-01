// ===========================================
// Wiki.js
// Licensed under AGPLv3
// ===========================================

const path = require('path')
const { DateTime } = require('luxon')
const semver = require('semver')
const nanoid = require('nanoid').customAlphabet('1234567890abcdef', 10)
const fs = require('fs-extra')

if (!semver.satisfies(process.version, '>=18')) {
  console.error('ERROR: Node.js 18.x or later required!')
  process.exit(1)
}

if (fs.pathExistsSync('./package.json')) {
  console.error('ERROR: Must run server from the parent directory!')
  process.exit(1)
}

let WIKI = {
  IS_DEBUG: process.env.NODE_ENV === 'development',
  ROOTPATH: process.cwd(),
  INSTANCE_ID: nanoid(10),
  SERVERPATH: path.join(process.cwd(), 'server'),
  Error: require('./helpers/error'),
  configSvc: require('./core/config'),
  kernel: require('./core/kernel'),
  sites: {},
  sitesMappings: {},
  startedAt: DateTime.utc(),
  storage: {
    defs: [],
    modules: []
  }
}
global.WIKI = WIKI

WIKI.configSvc.init()

// ----------------------------------------
// Init Logger
// ----------------------------------------

WIKI.logger = require('./core/logger').init()

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
