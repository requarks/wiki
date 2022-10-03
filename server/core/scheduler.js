const { DynamicThreadPool } = require('poolifier')
const os = require('node:os')
const { setTimeout } = require('node:timers/promises')

module.exports = {
  pool: null,
  maxWorkers: 1,
  activeWorkers: 0,
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
    WIKI.db.listener.addChannel('scheduler', payload => {
      switch (payload.event) {
        case 'newJob': {
          if (this.activeWorkers < this.maxWorkers) {
            this.activeWorkers++
            this.processJob()
          }
          break
        }
      }
    })
    // await WIKI.db.knex('jobs').insert({
    //   task: 'test',
    //   payload: { foo: 'bar' }
    // })
    // WIKI.db.listener.publish('scheduler', {
    //   source: WIKI.INSTANCE_ID,
    //   event: 'newJob'
    // })
    WIKI.logger.info('Scheduler: [ STARTED ]')
  },
  async processJob () {
    try {
      await WIKI.db.knex.transaction(async trx => {
        const jobs = await trx('jobs')
          .where('id', WIKI.db.knex.raw('(SELECT id FROM jobs ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1)'))
          .returning('*')
          .del()
        if (jobs && jobs.length === 1) {
          const job = jobs[0]
          WIKI.logger.info(`Processing new job ${job.id}: ${job.task}...`)
          if (job.useWorker) {
            await this.pool.execute({
              id: job.id,
              name: job.task,
              data: job.payload
            })
          } else {

          }
        }
      })
    } catch (err) {
      WIKI.logger.warn(err)
    }
  },
  async stop () {
    WIKI.logger.info('Stopping Scheduler...')
    await this.pool.stop()
    WIKI.logger.info('Scheduler: [ STOPPED ]')
  }
}
