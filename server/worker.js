const { ThreadWorker } = require('poolifier')
const { kebabCase } = require('lodash')
const path = require('node:path')

// ----------------------------------------
// Init Minimal Core
// ----------------------------------------

let WIKI = {
  IS_DEBUG: process.env.NODE_ENV === 'development',
  ROOTPATH: process.cwd(),
  INSTANCE_ID: 'worker',
  SERVERPATH: path.join(process.cwd(), 'server'),
  Error: require('./helpers/error'),
  configSvc: require('./core/config')
}
global.WIKI = WIKI

WIKI.configSvc.init(true)
WIKI.logger = require('./core/logger').init()

// ----------------------------------------
// Execute Task
// ----------------------------------------

module.exports = new ThreadWorker(async (job) => {
  WIKI.INSTANCE_ID = job.INSTANCE_ID
  const task = require(`./tasks/workers/${kebabCase(job.task)}.js`)
  await task(job)
  return true
}, { async: true })
