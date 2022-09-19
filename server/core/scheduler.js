const PgBoss = require('pg-boss')

/* global WIKI */

module.exports = {
  scheduler: null,
  jobs: [],
  init () {
    WIKI.logger.info('Initializing Scheduler...')
    this.scheduler = new PgBoss({
      ...WIKI.models.knex.client.connectionSettings,
      application_name: 'Wiki.js Scheduler',
      schema: WIKI.config.db.schemas.scheduler,
      uuid: 'v4'
    })
    return this
  },
  async start () {
    WIKI.logger.info('Starting Scheduler...')
    await this.scheduler.start()
    WIKI.logger.info('Scheduler: [ STARTED ]')
  },
  async stop () {
    WIKI.logger.info('Stopping Scheduler...')
    await this.scheduler.stop()
    WIKI.logger.info('Scheduler: [ STOPPED ]')
  }
}
