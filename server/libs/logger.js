'use strict'

module.exports = (isDebug, processName) => {
  let winston = require('winston')

  if (typeof processName === 'undefined') {
    processName = 'SERVER'
  }

  // Console

  let logger = new (winston.Logger)({
    level: (isDebug) ? 'debug' : 'info',
    transports: [
      new (winston.transports.Console)({
        level: (isDebug) ? 'debug' : 'info',
        prettyPrint: true,
        colorize: true,
        silent: false,
        timestamp: true
      })
    ]
  })

  logger.filters.push((level, msg) => {
    return '[' + processName + '] ' + msg
  })

  // External services

  if (appconfig.externalLogging.bugsnag) {
    const bugsnagTransport = require('./winston-transports/bugsnag')
    logger.add(bugsnagTransport, {
      level: 'warn',
      key: appconfig.externalLogging.bugsnag
    })
  }

  if (appconfig.externalLogging.loggly) {
    require('winston-loggly-bulk')
    logger.add(winston.transports.Loggly, {
      token: appconfig.externalLogging.loggly.token,
      subdomain: appconfig.externalLogging.loggly.subdomain,
      tags: ['wiki-js'],
      level: 'warn',
      json: true
    })
  }

  if (appconfig.externalLogging.papertrail) {
    require('winston-papertrail').Papertrail // eslint-disable-line no-unused-expressions
    logger.add(winston.transports.Papertrail, {
      host: appconfig.externalLogging.papertrail.host,
      port: appconfig.externalLogging.papertrail.port,
      level: 'warn',
      program: 'wiki.js'
    })
  }

  if (appconfig.externalLogging.rollbar) {
    const rollbarTransport = require('./winston-transports/rollbar')
    logger.add(rollbarTransport, {
      level: 'warn',
      key: appconfig.externalLogging.rollbar
    })
  }

  if (appconfig.externalLogging.sentry) {
    const sentryTransport = require('./winston-transports/sentry')
    logger.add(sentryTransport, {
      level: 'warn',
      key: appconfig.externalLogging.sentry
    })
  }

  return logger
}
