const { DynamicThreadPool } = require('poolifier')
const { v4: uuid } = require('uuid')
const os = require('node:os')
const path = require('node:path')

module.exports = {
  pool: null,
  runner: null,
  maxWorkers: 1,
  async init () {
    this.maxWorkers = WIKI.config.scheduler.workers === 'auto' ? os.cpus().length : WIKI.config.scheduler.workers
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
    // this.runner = await run({
    //   pgPool: new Pool({
    //     ...(typeof WIKI.db.config === 'string') ? {
    //       connectionString: WIKI.db.config
    //     } : WIKI.db.config,
    //     max: this.maxWorkers + 2
    //   }),
    //   schema: WIKI.config.db.schemas.scheduler,
    //   concurrency: this.maxWorkers,
    //   noHandleSignals: true,
    //   logger: new Logger(scope => {
    //     return (level, message, meta) => {
    //       const prefix = (scope?.workerId) ? `[${scope.workerId}] ` : ''
    //       WIKI.logger[level](`${prefix}${message}`, meta)
    //     }
    //   }),
    //   parsedCronItems: parseCronItems(WIKI.data.jobs),
    //   taskList: {
    //     simple: async (payload, helpers) => {
    //       // TODO: Handle task
    //     },
    //     background: async (payload, helpers) => {
    //       try {
    //         await this.pool.execute({
    //           id: helpers.job.id,
    //           name: payload.name,
    //           data: payload.data
    //         })
    //       } catch (err) {
    //         helpers.logger.warn(`Failed job: ${err.message}`)
    //         throw err
    //       }
    //     }
    //   }
    // })
    WIKI.logger.info('Scheduler: [ STARTED ]')
  },
  async stop () {
    WIKI.logger.info('Stopping Scheduler...')
    // await this.runner.stop()
    WIKI.logger.info('Scheduler: [ STOPPED ]')
  }
}
