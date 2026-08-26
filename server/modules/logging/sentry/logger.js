const Transport = require('winston-transport')
const { LEVEL } = require('triple-beam')

// ------------------------------------
// Sentry
// ------------------------------------

class SentryTransport extends Transport {
  constructor (opts) {
    super(opts)

    this.name = 'sentryLogger'
    this.level = opts.level || 'warn'
    this.Sentry = require('@sentry/node')
    this.Sentry.init({
      dsn: opts.key
    })
  }

  log (info, callback = () => {}) {
    const level = (info[LEVEL] === 'warn') ? 'warning' : info[LEVEL]
    this.Sentry.captureMessage(info.message, {
      level,
      extra: info
    })
    callback(null, true)
  }
}

module.exports = {
  init (logger, conf) {
    logger.add(new SentryTransport({
      level: 'warn',
      key: conf.key
    }))
  }
}
