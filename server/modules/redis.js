'use strict'

/* global wiki */

const Redis = require('ioredis')
const { isPlainObject } = require('lodash')

/**
 * Redis module
 *
 * @return     {Object}  Redis client wrapper instance
 */
module.exports = {

  /**
   * Initialize Redis client
   *
   * @return     {Object}  Redis client instance
   */
  init() {
    if (isPlainObject(wiki.config.redis)) {
      let red = new Redis(wiki.config.redis)
      red.on('ready', () => {
        wiki.logger.info('Redis connection: OK')
      })
      return red
    } else {
      wiki.logger.error('Invalid Redis configuration!')
      process.exit(1)
    }
  }

}
