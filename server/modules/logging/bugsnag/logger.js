const util = require('util')
const winston = require('winston')
const _ = require('lodash')

// ------------------------------------
// Bugsnag
// ------------------------------------

module.exports = {
  init (logger, conf) {
    let BugsnagLogger = winston.transports.BugsnagLogger = function (options) {
      this.name = 'bugsnagLogger'
      this.level = options.level || 'warn'
      this.bugsnag = require('bugsnag')
      this.bugsnag.register(options.key)
    }
    util.inherits(BugsnagLogger, winston.Transport)

    BugsnagLogger.prototype.log = function (level, msg, meta, callback) {
      this.bugsnag.notify(new Error(msg), _.assignIn(meta, { severity: level }))
      callback(null, true)
    }

    logger.add(new BugsnagLogger({
      level: 'warn',
      key: conf.key
    }))
  }
}
