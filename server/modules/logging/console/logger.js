const winston = require('winston')

/* global WIKI */

// ------------------------------------
// Console
// ------------------------------------

module.exports = {
  key: 'console',
  title: 'Console',
  props: [],
  init (logger, conf) {
    logger.add(new winston.transports.Console({
      level: WIKI.config.logLevel,
      prettyPrint: true,
      colorize: true,
      silent: false,
      timestamp: true
    }))
  }
}
