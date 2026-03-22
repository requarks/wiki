import { ThreadWorker } from 'poolifier'
import { kebabCase } from 'es-toolkit/string'
import path from 'node:path'
import configSvc from './core/config.js'
import logger from './core/logger.js'
import db from './core/db.js'

// ----------------------------------------
// Init Minimal Core
// ----------------------------------------

const WIKI = {
  IS_DEBUG: process.env.NODE_ENV === 'development',
  ROOTPATH: process.cwd(),
  INSTANCE_ID: 'worker',
  SERVERPATH: path.join(process.cwd(), 'backend'),
  configSvc,
  ensureDb: async () => {
    if (WIKI.db) {
      return true
    }

    WIKI.db = await db.init(true)

    try {
      await WIKI.configSvc.loadFromDb()
      await WIKI.configSvc.applyFlags()
    } catch (err) {
      WIKI.logger.error('Database Initialization Error: ' + err.message)
      if (WIKI.IS_DEBUG) {
        WIKI.logger.error(err)
      }
      process.exit(1)
    }
  }
}
global.WIKI = WIKI

await WIKI.configSvc.init(true)

// ----------------------------------------
// Init Logger
// ----------------------------------------

WIKI.logger = logger.init()

// ----------------------------------------
// Execute Task
// ----------------------------------------

export default new ThreadWorker(async (job) => {
  WIKI.INSTANCE_ID = job.INSTANCE_ID
  const task = (await import(`./tasks/workers/${kebabCase(job.task)}.js`)).task
  await task(job)
  return true
})
