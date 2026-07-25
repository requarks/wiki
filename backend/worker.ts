import { ThreadWorker } from 'poolifier'
import { kebabCase } from 'es-toolkit/string'
import path from 'node:path'
import configSvc from './core/config.ts'
import logger from './core/logger.ts'
import dbManager from './core/db.ts'

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

    WIKI.db = await dbManager.init(true)

    try {
      await WIKI.configSvc.loadFromDb()
    } catch (err: any) {
      WIKI.logger.error('Database Initialization Error: ' + err.message)
      if (WIKI.IS_DEBUG) {
        WIKI.logger.error(err)
      }
      process.exit(1)
    }
  }
} as unknown as WikiGlobal
global.WIKI = WIKI

await WIKI.configSvc.init(true)

// ----------------------------------------
// Init Logger
// ----------------------------------------

WIKI.logger = logger.init()

// ----------------------------------------
// Execute Task
// ----------------------------------------

export default new ThreadWorker(async (job: any) => {
  WIKI.INSTANCE_ID = job.INSTANCE_ID
  const task = (await import(`./tasks/workers/${kebabCase(job.task)}.ts`)).task
  await task(job)
  return true
})
