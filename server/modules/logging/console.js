const winston = require('winston')

/* global wiki */

// ------------------------------------
// Console
// ------------------------------------

module.exports = {
  key: 'console',
  title: 'Console',
  props: [],
  init (logger, conf) {
    logger.add(winston.transports.Console, {
      level: wiki.config.logLevel,
      prettyPrint: true,
      colorize: true,
      silent: false,
      timestamp: true
    })
  }
}
