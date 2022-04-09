const chalk = require('chalk')
const EventEmitter = require('events')

/* global WIKI */

const LEVELS = ['error', 'warn', 'info', 'debug']
const LEVELSIGNORED = ['verbose', 'silly']
const LEVELCOLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'cyan'
}

class Logger extends EventEmitter {}
const primaryLogger = new Logger()

let ignoreNextLevels = false

LEVELS.forEach(lvl => {
  primaryLogger[lvl] = (...args) => {
    primaryLogger.emit(lvl, ...args)
  }

  if (!ignoreNextLevels) {
    primaryLogger.on(lvl, (msg) => {
      if (WIKI.config.logFormat === 'json') {
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          instance: WIKI.INSTANCE_ID,
          level: lvl,
          message: msg
        }))
      } else {
        console.log(chalk`${new Date().toISOString()} {dim [${WIKI.INSTANCE_ID}]} {${LEVELCOLORS[lvl]}.bold ${lvl}}: ${msg}`)
      }
    })
  }
  if (lvl === WIKI.config.logLevel) {
    ignoreNextLevels = true
  }
})

LEVELSIGNORED.forEach(lvl => {
  primaryLogger[lvl] = () => {}
})

module.exports = {
  loggers: {},
  init () {
    return primaryLogger
  }
}
