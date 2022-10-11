const { DateTime } = require('luxon')

module.exports = async (payload) => {
  WIKI.logger.info('Cleaning scheduler job history...')

  try {
    await WIKI.db.knex('jobHistory')
      .whereNot('state', 'active')
      .andWhere('startedAt', '<=', DateTime.utc().minus({ seconds: WIKI.config.scheduler.historyExpiration }).toISO())
      .del()

    WIKI.logger.info('Cleaned scheduler job history: [ COMPLETED ]')
  } catch (err) {
    WIKI.logger.error('Cleaning scheduler job history: [ FAILED ]')
    WIKI.logger.error(err.message)
  }
}
