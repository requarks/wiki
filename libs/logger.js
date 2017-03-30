'use strict'

const winston = require('winston')

module.exports = (isDebug) => {
  if (typeof PROCNAME === 'undefined') {
    const PROCNAME = 'SERVER' // eslint-disable-line no-unused-vars
  }

  // Console + File Logs

  winston.remove(winston.transports.Console)
  winston.add(winston.transports.Console, {
    level: (isDebug) ? 'debug' : 'info',
    prettyPrint: true,
    colorize: true,
    silent: false,
    timestamp: true,
    filters: [(level, msg, meta) => {
      return '[' + PROCNAME + '] ' + msg // eslint-disable-line no-undef
    }]
  })

  // External services

  if (appconfig.externalLogging.bugsnag) {
    const bugsnagTransport = require('./winston-transports/bugsnag')
    winston.add(bugsnagTransport, {
      level: 'warn',
      key: appconfig.externalLogging.bugsnag
    })
  }

  if (appconfig.externalLogging.loggly) {
    require('winston-loggly-bulk')
    winston.add(winston.transports.Loggly, {
      token: appconfig.externalLogging.loggly.token,
      subdomain: appconfig.externalLogging.loggly.subdomain,
      tags: ['wiki-js'],
      level: 'warn',
      json: true
    })
  }

  if (appconfig.externalLogging.papertrail) {
    require('winston-papertrail').Papertrail // eslint-disable-line no-unused-expressions
    winston.add(winston.transports.Papertrail, {
      host: appconfig.externalLogging.papertrail.host,
      port: appconfig.externalLogging.papertrail.port,
      level: 'warn',
      program: 'wiki.js'
    })
  }

  if (appconfig.externalLogging.rollbar) {
    const rollbarTransport = require('./winston-transports/rollbar')
    winston.add(rollbarTransport, {
      level: 'warn',
      key: appconfig.externalLogging.rollbar
    })
  }

  if (appconfig.externalLogging.sentry) {
    const sentryTransport = require('./winston-transports/sentry')
    winston.add(sentryTransport, {
      level: 'warn',
      key: appconfig.externalLogging.sentry
    })
  }

  return winston
}
