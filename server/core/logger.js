// const _ = require('lodash')
const winston = require('winston')

/* global WIKI */

module.exports = {
  loggers: {},
  init(uid) {
    let loggerFormats = [
      winston.format.label({ label: uid }),
      winston.format.timestamp()
    ]

    if (WIKI.config.jsonLogs === true) {
      loggerFormats.push(winston.format.json())
    } else {
      loggerFormats.push(...[
        winston.format.colorize(),
        winston.format.printf(info => `${info.timestamp} [${info.label}] ${info.level}: ${info.message}`)
      ])
    }

    let logger = winston.createLogger({
      level: WIKI.config.logLevel,
      format: winston.format.combine(...loggerFormats)
    })

    // Init Console (default)

    logger.add(new winston.transports.Console({
      level: WIKI.config.logLevel,
      prettyPrint: true,
      colorize: true,
      silent: false,
      timestamp: true
    }))

    // _.forOwn(_.omitBy(WIKI.config.logging.loggers, s => s.enabled === false), (loggerConfig, loggerKey) => {
    //   let loggerModule = require(`../modules/logging/${loggerKey}`)
    //   loggerModule.init(logger, loggerConfig)
    //   this.loggers[logger.key] = loggerModule
    // })

    return logger
  }
}
