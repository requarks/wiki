/* global WIKI */

module.exports = async () => {
  WIKI.logger.info('Purging page history...')

  try {
    WIKI.models = require('../core/db').init()
    await WIKI.configSvc.loadFromDb()
    await WIKI.configSvc.applyFlags()
    await WIKI.models.pageHistory.purge(WIKI.config.purgePageHistoryOlderThan)
    await WIKI.models.knex.destroy()
  } catch (err) {
    WIKI.logger.error('Purging page history: [ FAILED ]')
    WIKI.logger.error(err.message)
  }
}
