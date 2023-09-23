import { ThreadWorker } from 'poolifier'
import { kebabCase } from 'lodash-es'
import path from 'node:path'
import configSvc from './core/config.mjs'
import logger from './core/logger.mjs'
import db from './core/db.mjs'

// ----------------------------------------
// Init Minimal Core
// ----------------------------------------

const WIKI = {
  IS_DEBUG: process.env.NODE_ENV === 'development',
  ROOTPATH: process.cwd(),
  INSTANCE_ID: 'worker',
  SERVERPATH: path.join(process.cwd(), 'server'),
  configSvc,
  ensureDb: async () => {
    if (WIKI.db) { return true }

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
  const task = (await import(`./tasks/workers/${kebabCase(job.task)}.mjs`)).task
  await task(job)
  return true
})
