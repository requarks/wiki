const Bull = require('bull')
const Promise = require('bluebird')

/* global WIKI */

module.exports = {
  init() {
    WIKI.data.queues.forEach(queueName => {
      this[queueName] = new Bull(queueName, {
        prefix: `q-${WIKI.config.ha.nodeuid}`,
        redis: WIKI.config.redis
      })
    })
    return this
  },
  clean() {
    return Promise.each(WIKI.data.queues, queueName => {
      return new Promise((resolve, reject) => {
        let keyStream = WIKI.redis.scanStream({
          match: `q-${WIKI.config.ha.nodeuid}:${queueName}:*`
        })
        keyStream.on('data', resultKeys => {
          if (resultKeys.length > 0) {
            WIKI.redis.del(resultKeys)
          }
        })
        keyStream.on('end', resolve)
      })
    }).then(() => {
      WIKI.logger.info('Purging old queue jobs: [ OK ]')
    }).return(true).catch(err => {
      WIKI.logger.error(err)
    })
  }
}
