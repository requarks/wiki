'use strict'

/* global wiki */

const cluster = require('cluster')

module.exports = {
  init() {
    let winston = require('winston')

    // Console

    let logger = new (winston.Logger)({
      level: (wiki.IS_DEBUG) ? 'debug' : 'info',
      transports: [
        new (winston.transports.Console)({
          level: (wiki.IS_DEBUG) ? 'debug' : 'info',
          prettyPrint: true,
          colorize: true,
          silent: false,
          timestamp: true
        })
      ]
    })

    logger.filters.push((level, msg) => {
      let processName = (cluster.isMaster) ? 'MASTER' : `WORKER-${cluster.worker.id}`
      return '[' + processName + '] ' + msg
    })

    // External services

    // if (wiki.config.externalLogging.bugsnag) {
    //   const bugsnagTransport = require('./winston-transports/bugsnag')
    //   logger.add(bugsnagTransport, {
    //     level: 'warn',
    //     key: wiki.config.externalLogging.bugsnag
    //   })
    // }

    // if (wiki.config.externalLogging.loggly) {
    //   require('winston-loggly-bulk')
    //   logger.add(winston.transports.Loggly, {
    //     token: wiki.config.externalLogging.loggly.token,
    //     subdomain: wiki.config.externalLogging.loggly.subdomain,
    //     tags: ['wiki-js'],
    //     level: 'warn',
    //     json: true
    //   })
    // }

    // if (wiki.config.externalLogging.papertrail) {
    //   require('winston-papertrail').Papertrail // eslint-disable-line no-unused-expressions
    //   logger.add(winston.transports.Papertrail, {
    //     host: wiki.config.externalLogging.papertrail.host,
    //     port: wiki.config.externalLogging.papertrail.port,
    //     level: 'warn',
    //     program: 'wiki.js'
    //   })
    // }

    // if (wiki.config.externalLogging.rollbar) {
    //   const rollbarTransport = require('./winston-transports/rollbar')
    //   logger.add(rollbarTransport, {
    //     level: 'warn',
    //     key: wiki.config.externalLogging.rollbar
    //   })
    // }

    // if (wiki.config.externalLogging.sentry) {
    //   const sentryTransport = require('./winston-transports/sentry')
    //   logger.add(sentryTransport, {
    //     level: 'warn',
    //     key: wiki.config.externalLogging.sentry
    //   })
    // }

    return logger
  }
}
