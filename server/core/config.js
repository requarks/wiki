const _ = require('lodash')
const chalk = require('chalk')
const cfgHelper = require('../helpers/config')
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

/* global WIKI */

module.exports = {
  /**
   * Load root config from disk
   */
  init() {
    let confPaths = {
      config: path.join(WIKI.ROOTPATH, 'config.yml'),
      data: path.join(WIKI.SERVERPATH, 'app/data.yml'),
      dataRegex: path.join(WIKI.SERVERPATH, 'app/regex.js')
    }

    if (process.env.dockerdev) {
      confPaths.config = path.join(WIKI.ROOTPATH, `dev/containers/config.yml`)
    }

    if (process.env.CONFIG_FILE) {
      confPaths.config = path.resolve(WIKI.ROOTPATH, process.env.CONFIG_FILE)
    }

    process.stdout.write(chalk.blue(`Loading configuration from ${confPaths.config}... `))

    let appconfig = {}
    let appdata = {}

    try {
      appconfig = yaml.safeLoad(
        cfgHelper.parseConfigValue(
          fs.readFileSync(confPaths.config, 'utf8')
        )
      )
      appdata = yaml.safeLoad(fs.readFileSync(confPaths.data, 'utf8'))
      appdata.regex = require(confPaths.dataRegex)
      console.info(chalk.green.bold(`OK`))
    } catch (err) {
      console.error(chalk.red.bold(`FAILED`))
      console.error(err.message)

      console.error(chalk.red.bold(`>>> Unable to read configuration file! Did you create the config.yml file?`))
      process.exit(1)
    }

    // Merge with defaults

    appconfig = _.defaultsDeep(appconfig, appdata.defaults.config)

    if (appconfig.port < 1 || process.env.HEROKU) {
      appconfig.port = process.env.PORT || 80
    }

    const packageInfo = require(path.join(WIKI.ROOTPATH, 'package.json'))

    // Load DB Password from Docker Secret File
    if (process.env.DB_PASS_FILE) {
      console.info(chalk.blue(`DB_PASS_FILE is defined. Will use secret from file.`))
      try {
        appconfig.db.pass = fs.readFileSync(process.env.DB_PASS_FILE, 'utf8').trim()
      } catch (err) {
        console.error(chalk.red.bold(`>>> Failed to read Docker Secret File using path defined in DB_PASS_FILE env variable!`))
        console.error(err.message)
        process.exit(1)
      }
    }

    WIKI.config = appconfig
    WIKI.data = appdata
    WIKI.version = packageInfo.version
    WIKI.releaseDate = packageInfo.releaseDate
    WIKI.devMode = (packageInfo.dev === true)
  },

  /**
   * Load config from DB
   */
  async loadFromDb() {
    let conf = await WIKI.models.settings.getConfig()
    if (conf) {
      WIKI.config = _.defaultsDeep(conf, WIKI.config)
    } else {
      WIKI.logger.warn('DB Configuration is empty or incomplete. Switching to Setup mode...')
      WIKI.config.setup = true
    }
  },
  /**
   * Save config to DB
   *
   * @param {Array} keys Array of keys to save
   * @returns Promise
   */
  async saveToDb(keys, propagate = true) {
    try {
      for (let key of keys) {
        let value = _.get(WIKI.config, key, null)
        if (!_.isPlainObject(value)) {
          value = { v: value }
        }
        let affectedRows = await WIKI.models.settings.query().patch({ value }).where('key', key)
        if (affectedRows === 0 && value) {
          await WIKI.models.settings.query().insert({ key, value })
        }
      }
      if (propagate) {
        WIKI.events.outbound.emit('reloadConfig')
      }
    } catch (err) {
      WIKI.logger.error(`Failed to save configuration to DB: ${err.message}`)
      return false
    }

    return true
  },
  /**
   * Apply Dev Flags
   */
  async applyFlags() {
    WIKI.models.knex.client.config.debug = WIKI.config.flags.sqllog
  },

  /**
   * Subscribe to HA propagation events
   */
  subscribeToEvents() {
    WIKI.events.inbound.on('reloadConfig', async () => {
      await WIKI.configSvc.loadFromDb()
      await WIKI.configSvc.applyFlags()
    })
  }
}
