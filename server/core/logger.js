// const _ = require('lodash')
const winston = require('winston')

/* global WIKI */

module.exports = {
  loggers: {},
  init(uid) {
    let logger = winston.createLogger({
      level: WIKI.config.logLevel,
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.label({ label: uid }),
        winston.format.timestamp(),
        winston.format.printf(info => `${info.timestamp} [${info.label}] ${info.level}: ${info.message}`)
      )
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
