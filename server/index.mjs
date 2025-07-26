// ===========================================
// Wiki.js Server
// Licensed under AGPLv3
// ===========================================

import path from 'node:path'
import { DateTime } from 'luxon'
import semver from 'semver'
import { customAlphabet } from 'nanoid'
import fse from 'fs-extra'
import configSvc from './core/config.mjs'
import kernel from './core/kernel.mjs'
import logger from './core/logger.mjs'

const nanoid = customAlphabet('1234567890abcdef', 10)

if (!semver.satisfies(process.version, '>=24')) {
  console.error('ERROR: Node.js 24.x or later required!')
  process.exit(1)
}

if (fse.pathExistsSync('./package.json')) {
  console.error('ERROR: Must run server from the parent directory!')
  process.exit(1)
}

const WIKI = {
  IS_DEBUG: process.env.NODE_ENV === 'development',
  ROOTPATH: process.cwd(),
  INSTANCE_ID: nanoid(10),
  SERVERPATH: path.join(process.cwd(), 'server'),
  configSvc,
  kernel,
  sites: {},
  sitesMappings: {},
  startedAt: DateTime.utc(),
  storage: {
    defs: [],
    modules: []
  }
}
global.WIKI = WIKI

if (WIKI.IS_DEBUG) {
  process.on('warning', (warning) => {
    console.log(warning.stack)
  })
}

await WIKI.configSvc.init()

// ----------------------------------------
// Init Logger
// ----------------------------------------

WIKI.logger = logger.init()

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
