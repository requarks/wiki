/* global wiki */

const cluster = require('cluster')
const _ = require('lodash')
const fs = require('fs-extra')
const path = require('path')

module.exports = {
  loggers: {},
  init() {
    let winston = require('winston')

    let logger = new (winston.Logger)({
      level: wiki.config.logLevel,
      transports: []
    })

    logger.filters.push((level, msg) => {
      let processName = (cluster.isMaster) ? 'MASTER' : `WORKER-${cluster.worker.id}`
      return '[' + processName + '] ' + msg
    })

    _.forOwn(_.omitBy(wiki.config.logging.loggers, s => s.enabled === false), (loggerConfig, loggerKey) => {
      let loggerModule = require(`../extensions/logging/${loggerKey}`)
      loggerModule.init(logger, loggerConfig)
      fs.readFile(path.join(wiki.ROOTPATH, `assets/svg/auth-icon-${loggerKey}.svg`), 'utf8').then(iconData => {
        logger.icon = iconData
      }).catch(err => {
        if (err.code === 'ENOENT') {
          logger.icon = '[missing icon]'
        } else {
          logger.error(err)
        }
      })
      this.loggers[logger.key] = loggerModule
    })

    return logger
  }
}
