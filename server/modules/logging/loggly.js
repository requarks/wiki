const winston = require('winston')

// ------------------------------------
// Loggly
// ------------------------------------

module.exports = {
  key: 'loggly',
  title: 'Loggly',
  props: ['token', 'subdomain'],
  init (logger, conf) {
    require('winston-loggly-bulk')
    logger.add(winston.transports.Loggly, {
      token: conf.token,
      subdomain: conf.subdomain,
      tags: ['wiki-js'],
      level: 'warn',
      json: true
    })
  }
}
