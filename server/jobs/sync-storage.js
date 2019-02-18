const _ = require('lodash')

/* global WIKI */

module.exports = async (targetKey) => {
  WIKI.logger.info(`Syncing with storage target ${targetKey}...`)

  try {
    const target = _.find(WIKI.models.storage.targets, ['key', targetKey])
    if (target) {
      await target.fn.sync()
      WIKI.logger.info(`Syncing with storage target ${targetKey}: [ COMPLETED ]`)
    } else {
      throw new Error('Invalid storage target. Unable to perform sync.')
    }
  } catch (err) {
    WIKI.logger.error(`Syncing with storage target ${targetKey}: [ FAILED ]`)
    WIKI.logger.error(err.message)
  }
}
