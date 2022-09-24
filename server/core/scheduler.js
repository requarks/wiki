const PgBoss = require('pg-boss')
const { DynamicThreadPool } = require('poolifier')
const os = require('node:os')

/* global WIKI */

module.exports = {
  pool: null,
  scheduler: null,
  async init () {
    WIKI.logger.info('Initializing Scheduler...')
    this.scheduler = new PgBoss({
      db: {
        close: () => Promise.resolve('ok'),
        executeSql: async (text, values) => {
          try {
            const resource = await WIKI.models.knex.client.pool.acquire().promise
            const res = await resource.query(text, values)
            WIKI.models.knex.client.pool.release(resource)
            return res
          } catch (err) {
            WIKI.logger.error('Failed to acquire DB connection during scheduler query execution.')
            WIKI.logger.error(err)
          }
        }
      },
      // ...WIKI.models.knex.client.connectionSettings,
      application_name: 'Wiki.js Scheduler',
      schema: WIKI.config.db.schemas.scheduler,
      uuid: 'v4'
    })

    const maxWorkers = WIKI.config.workers === 'auto' ? os.cpus().length : WIKI.config.workers
    WIKI.logger.info(`Initializing Worker Pool (Max ${maxWorkers})...`)
    this.pool = new DynamicThreadPool(1, maxWorkers, './server/worker.js', {
      errorHandler: (err) => WIKI.logger.warn(err),
      exitHandler: () => WIKI.logger.debug('A worker has gone offline.'),
      onlineHandler: () => WIKI.logger.debug('New worker is online.')
    })
    return this
  },
  async start () {
    WIKI.logger.info('Starting Scheduler...')
    await this.scheduler.start()
    this.scheduler.work('*', async job => {
      return this.pool.execute({
        id: job.id,
        name: job.name,
        data: job.data
      })
    })
    WIKI.logger.info('Scheduler: [ STARTED ]')
  },
  async stop () {
    WIKI.logger.info('Stopping Scheduler...')
    await this.scheduler.stop()
    await this.pool.destroy()
    WIKI.logger.info('Scheduler: [ STOPPED ]')
  }
}
