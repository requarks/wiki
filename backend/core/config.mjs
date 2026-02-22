import { defaultsDeep, get, isPlainObject } from 'lodash-es'
import chalk from 'chalk'
import cfgHelper from '../helpers/config.mjs'
import fs from 'node:fs/promises'
import path from 'node:path'
import yaml from 'js-yaml'
import { v4 as uuid } from 'uuid'

export default {
  /**
   * Load root config from disk
   */
  async init (silent = false) {
    const confPaths = {
      config: path.join(WIKI.ROOTPATH, 'config.yml'),
      data: path.join(WIKI.SERVERPATH, 'base.yml')
    }

    if (process.env.CONFIG_FILE) {
      confPaths.config = path.resolve(WIKI.ROOTPATH, process.env.CONFIG_FILE)
    }

    if (!silent) {
      process.stdout.write(chalk.blue(`Loading configuration from ${confPaths.config}... `))
    }

    let appconfig = {}
    let appdata = {}

    try {
      appconfig = yaml.load(
        cfgHelper.parseConfigValue(
          await fs.readFile(confPaths.config, 'utf8')
        )
      )
      appdata = yaml.load(await fs.readFile(confPaths.data, 'utf8'))
      if (!silent) {
        console.info(chalk.green.bold('OK'))
      }
    } catch (err) {
      console.error(chalk.red.bold('FAILED'))
      console.error(err.message)

      console.error(chalk.red.bold('>>> Unable to read configuration file! Did you create the config.yml file?'))
      process.exit(1)
    }

    // Merge with defaults

    appconfig = defaultsDeep(appconfig, appdata.defaults.config)

    // Override port

    if (appconfig.port < 1) {
      appconfig.port = process.env.PORT || 80
    }

    if (process.env.WIKI_PORT) {
      appconfig.port = process.env.WIKI_PORT || 80
    }

    // Load package info

    const packageInfo = JSON.parse(await fs.readFile(path.join(WIKI.SERVERPATH, 'package.json'), 'utf-8'))

    // Load DB Password from Docker Secret File
    if (process.env.DB_PASS_FILE) {
      if (!silent) {
        console.info(chalk.blue('DB_PASS_FILE is defined. Will use secret from file.'))
      }
      try {
        appconfig.db.pass = await fs.readFile(process.env.DB_PASS_FILE, 'utf8').trim()
      } catch (err) {
        console.error(chalk.red.bold('>>> Failed to read Docker Secret File using path defined in DB_PASS_FILE env variable!'))
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
  async loadFromDb () {
    WIKI.logger.info('Loading settings from DB...')
    const conf = await WIKI.models.settings.getConfig()
    if (conf) {
      WIKI.config = defaultsDeep(conf, WIKI.config)
      return true
    } else {
      return false
    }
  },
  /**
   * Save config to DB
   *
   * @param {Array} keys Array of keys to save
   * @returns Promise
   */
  async saveToDb (keys, propagate = true) {
    try {
      for (const key of keys) {
        let value = get(WIKI.config, key, null)
        if (!isPlainObject(value)) {
          value = { v: value }
        }
        await WIKI.models.settings.updateConfig(key, value)
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
   * Initialize DB tables with default values
   */
  async initDbValues () {
    const ids = {
      groupAdminId: uuid(),
      groupUserId: WIKI.data.systemIds.usersGroupId,
      groupGuestId: WIKI.data.systemIds.guestsGroupId,
      siteId: uuid(),
      authModuleId: WIKI.data.systemIds.localAuthId,
      userAdminId: uuid(),
      userGuestId: uuid()
    }

    await WIKI.models.settings.init(ids)
    await WIKI.models.sites.init(ids)
    await WIKI.models.groups.init(ids)
    await WIKI.models.authentication.init(ids)
    await WIKI.models.users.init(ids)
  },
  /**
   * Subscribe to HA propagation events
   */
  subscribeToEvents () {
    WIKI.events.inbound.on('reloadConfig', async () => {
      await WIKI.configSvc.loadFromDb()
    })
  }
}
