const util = require('util')
const winston = require('winston')

// ------------------------------------
// Sentry
// ------------------------------------

module.exports = {
  key: 'sentry',
  title: 'Sentry',
  props: ['key'],
  init (logger, conf) {
    let SentryLogger = winston.transports.RollbarLogger = function (options) {
      this.name = 'sentryLogger'
      this.level = options.level || 'warn'
      this.raven = require('raven')
      this.raven.config(options.key).install()
    }
    util.inherits(SentryLogger, winston.Transport)

    SentryLogger.prototype.log = function (level, msg, meta, callback) {
      level = (level === 'warn') ? 'warning' : level
      this.raven.captureMessage(msg, { level, extra: meta })
      callback(null, true)
    }

    logger.add(SentryLogger, {
      level: 'warn',
      key: conf.key
    })
  }
}
