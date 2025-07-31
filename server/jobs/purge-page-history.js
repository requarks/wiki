/* global WIKI */

module.exports = async () => {
  WIKI.logger.info('Purging page history...')

  try {
    await WIKI.configSvc.loadFromDb()
    await WIKI.configSvc.applyFlags()
    const purgePageHistoryOlderThan =
      process.env.PURGE_PAGE_HISTORY_OLDER_THAN ??
      WIKI.config.purgePageHistoryOlderThan ??
      'P2Y'
    await WIKI.models.pageHistory.purge(purgePageHistoryOlderThan)
  } catch (err) {
    WIKI.logger.error('Purging page history: [ FAILED ]')
    WIKI.logger.error(err.message)
  }
}
