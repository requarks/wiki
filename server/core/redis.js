const Redis = require('ioredis')
const { isPlainObject } = require('lodash')

/* global wiki */

module.exports = {
  init() {
    if (isPlainObject(wiki.config.redis)) {
      let red = new Redis(wiki.config.redis)
      red.on('ready', () => {
        wiki.logger.info('Redis connection: [ OK ]')
      })
      red.on('error', () => {
        wiki.logger.error('Failed to connect to Redis instance!')
        process.exit(1)
      })
      return red
    } else {
      wiki.logger.error('Invalid Redis configuration!')
      process.exit(1)
    }
  }
}
