const path = require('path')
const Bull = require('bull')
const Promise = require('bluebird')
const _ = require('lodash')

/* global WIKI */

module.exports = {
  job: {},
  init() {
    _.forOwn(WIKI.data.jobs, (queueParams, queueName) => {
      this.job[queueName] = new Bull(queueName, {
        prefix: `q-${WIKI.config.ha.uid}`,
        redis: WIKI.config.redis
      })
      this.job[queueName].process(path.join(WIKI.SERVERPATH, `jobs/${_.kebabCase(queueName)}.js`))
    })
    return this
  },
  start() {
    _.forOwn(WIKI.data.jobs, (queueParams, queueName) => {
      if (queueParams.onInit) {
        this.job[queueName].add({}, {
          removeOnComplete: true
        })
      }
      if (queueParams.cron) {
        this.job[queueName].add({}, {
          repeat: { cron: queueParams.cron },
          removeOnComplete: true
        })
      }
    })
  },
  async clean() {
    return Promise.each(_.keys(WIKI.data.jobs), queueName => {
      return new Promise((resolve, reject) => {
        let keyStream = WIKI.redis.scanStream({
          match: `q-${WIKI.config.ha.uid}:${queueName}:*`
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
