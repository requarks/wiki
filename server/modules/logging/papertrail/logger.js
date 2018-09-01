const winston = require('winston')

// ------------------------------------
// Papertrail
// ------------------------------------

module.exports = {
  init (logger, conf) {
    require('winston-papertrail').Papertrail // eslint-disable-line no-unused-expressions
    logger.add(new winston.transports.Papertrail({
      host: conf.host,
      port: conf.port,
      level: 'warn',
      program: 'wiki.js'
    }))
  }
}
