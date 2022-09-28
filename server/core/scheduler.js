const PgBoss = require('pg-boss')
const { DynamicThreadPool } = require('poolifier')
const os = require('node:os')

/* global WIKI */

module.exports = {
  pool: null,
  boss: null,
  maxWorkers: 1,
  async init () {
    WIKI.logger.info('Initializing Scheduler...')
    this.boss = new PgBoss({
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
      uuid: 'v4',
      archiveCompletedAfterSeconds: 120,
      deleteAfterHours: 24
    })

    this.maxWorkers = WIKI.config.workers === 'auto' ? os.cpus().length : WIKI.config.workers
    WIKI.logger.info(`Initializing Worker Pool (Limit: ${this.maxWorkers})...`)
    this.pool = new DynamicThreadPool(1, this.maxWorkers, './server/worker.js', {
      errorHandler: (err) => WIKI.logger.warn(err),
      exitHandler: () => WIKI.logger.debug('A worker has gone offline.'),
      onlineHandler: () => WIKI.logger.debug('New worker is online.')
    })
    return this
  },
  async start () {
    WIKI.logger.info('Starting Scheduler...')
    await this.boss.start()
    this.boss.work('wk-*', {
      teamSize: this.maxWorkers,
      teamConcurrency: this.maxWorkers
    }, async job => {
      WIKI.logger.debug(`Starting job ${job.name}:${job.id}...`)
      try {
        const result = await this.pool.execute({
          id: job.id,
          name: job.name,
          data: job.data
        })
        WIKI.logger.debug(`Completed job ${job.name}:${job.id}.`)
        job.done(null, result)
      } catch (err) {
        WIKI.logger.warn(`Failed job ${job.name}:${job.id}): ${err.message}`)
        job.done(err)
      }
      this.boss.complete(job.id)
    })
    WIKI.logger.info('Scheduler: [ STARTED ]')
  },
  async stop () {
    WIKI.logger.info('Stopping Scheduler...')
    await this.boss.stop({ timeout: 5000 })
    await this.pool.destroy()
    WIKI.logger.info('Scheduler: [ STOPPED ]')
  },
  async registerScheduledJobs () {
    for (const [key, job] of Object.entries(WIKI.data.jobs)) {
      if (job.schedule) {
        WIKI.logger.debug(`Scheduling regular job ${key}...`)
        await this.boss.schedule(`wk-${key}`, job.schedule)
      }
    }
  }
}
