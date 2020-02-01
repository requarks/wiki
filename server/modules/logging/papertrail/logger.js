const winston = require('winston')

// ------------------------------------
// Papertrail
// ------------------------------------

module.exports = {
  init (logger, conf) {
    // eslint-disable-next-line no-unused-expressions
    require('winston-papertrail').Papertrail // NOSONAR
    logger.add(new winston.transports.Papertrail({
      host: conf.host,
      port: conf.port,
      level: 'warn',
      program: 'wiki.js'
    }))
  }
}
