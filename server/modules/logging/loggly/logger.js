const winston = require('winston')

// ------------------------------------
// Loggly
// ------------------------------------

module.exports = {
  init (logger, conf) {
    require('winston-loggly-bulk')
    logger.add(new winston.transports.Loggly({
      token: conf.token,
      subdomain: conf.subdomain,
      tags: ['wiki-js'],
      level: 'warn',
      json: true
    }))
  }
}
