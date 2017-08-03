'use strict'

/* global wiki */

const Bull = require('bull')
const Promise = require('bluebird')

module.exports = {
  init() {
    wiki.data.queues.forEach(queueName => {
      this[queueName] = new Bull(queueName, {
        prefix: `q-${wiki.config.ha.nodeuid}`,
        redis: wiki.config.redis
      })
    })
    return this
  },
  clean() {
    return Promise.each(wiki.data.queues, queueName => {
      return new Promise((resolve, reject) => {
        let keyStream = wiki.redis.scanStream({
          match: `q-${wiki.config.ha.nodeuid}:${queueName}:*`
        })
        keyStream.on('data', resultKeys => {
          if (resultKeys.length > 0) {
            wiki.redis.del(resultKeys)
          }
        })
        keyStream.on('end', resolve)
      })
    }).then(() => {
      wiki.logger.info('Purging old queue jobs: OK')
    }).catch(err => {
      wiki.logger.error(err)
    })
  }
}
