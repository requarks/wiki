import chalk from 'chalk'
import EventEmitter from 'node:events'

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'
export type IgnoredLogLevel = 'verbose' | 'silly'
export type LogFn = (...args: unknown[]) => void

const LEVELS: LogLevel[] = ['error', 'warn', 'info', 'debug']
const LEVELSIGNORED: IgnoredLogLevel[] = ['verbose', 'silly']
const LEVELCOLORS: Record<LogLevel, 'red' | 'yellow' | 'green' | 'cyan'> = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'cyan'
}

class Logger extends EventEmitter {
  // -> Assigned dynamically in init(). `declare` keeps these type-only so that no class field is
  //    emitted, leaving the runtime shape of the instance untouched.
  declare ws: EventEmitter
  declare error: LogFn
  declare warn: LogFn
  declare info: LogFn
  declare debug: LogFn
  declare verbose: LogFn
  declare silly: LogFn
}

export default {
  loggers: {},
  init(): Logger {
    const primaryLogger = new Logger()

    let ignoreNextLevels = false

    primaryLogger.ws = new EventEmitter()

    LEVELS.forEach((lvl) => {
      primaryLogger[lvl] = (...args: unknown[]) => {
        primaryLogger.emit(lvl, ...args)
      }

      if (!ignoreNextLevels) {
        primaryLogger.on(lvl, (msg: unknown) => {
          let formatted = ''
          if (WIKI.config.logFormat === 'json') {
            formatted = JSON.stringify({
              timestamp: new Date().toISOString(),
              instance: WIKI.INSTANCE_ID,
              level: lvl,
              message: msg
            })
          } else {
            if (msg instanceof Error) {
              msg = msg.stack
            }
            formatted = `${new Date().toISOString()} ${chalk.dim('[' + WIKI.INSTANCE_ID + ']')} ${chalk[LEVELCOLORS[lvl]].bold(lvl)}: ${msg}`
          }

          console.log(formatted)
          primaryLogger.ws.emit('log', formatted)
        })
      }
      if (lvl === WIKI.config.logLevel) {
        ignoreNextLevels = true
      }
    })

    LEVELSIGNORED.forEach((lvl) => {
      primaryLogger[lvl] = () => {}
    })

    return primaryLogger
  }
}
