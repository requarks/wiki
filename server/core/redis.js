const Redis = require('ioredis')
const { isPlainObject } = require('lodash')

/* global WIKI */

module.exports = {
  init() {
    if (isPlainObject(WIKI.config.redis)) {
      let red = new Redis(WIKI.config.redis)
      red.on('ready', () => {
        WIKI.logger.info('Redis connection: [ OK ]')
      })
      red.on('error', () => {
        WIKI.logger.error('Failed to connect to Redis instance!')
        process.exit(1)
      })
      return red
    } else {
      WIKI.logger.error('Invalid Redis configuration!')
      process.exit(1)
    }
  },
  subscribe() {
    let red = this.init()
    red.on('message', (channel, msg) => {
      WIKI.events.emit(channel, msg)
    })
    red.subscribe('localization', (err, count) => {
      if (err) {
        WIKI.logger.error(err)
        process.exit(1)
      }
      WIKI.logger.info('Redis Subscriber connection: [ OK ]')
    })
    return red
  }
}
