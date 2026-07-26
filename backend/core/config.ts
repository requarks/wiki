import { toMerged } from 'es-toolkit/object'
import { isPlainObject } from 'es-toolkit/predicate'
import chalk from 'chalk'
import cfgHelper from '../helpers/config.ts'
import fs from 'node:fs/promises'
import path from 'node:path'
import yaml from 'js-yaml'
import { v4 as uuid } from 'uuid'

/**
 * Config is assembled at runtime from config.yml + base.yml + the `settings` DB table, so its shape
 * is only known dynamically. Kept loose on purpose.
 */
type ConfigObject = Record<string, any>

export default {
  /**
   * Load root config from disk
   */
  async init(silent = false): Promise<void> {
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

    let appconfig: ConfigObject = {}
    let appdata: ConfigObject = {}

    try {
      appconfig = yaml.load(
        cfgHelper.parseConfigValue(await fs.readFile(confPaths.config, 'utf8'))
      ) as ConfigObject
      appdata = yaml.load(await fs.readFile(confPaths.data, 'utf8')) as ConfigObject
      if (!silent) {
        console.info(chalk.green.bold('OK'))
      }
    } catch (err: any) {
      console.error(chalk.red.bold('FAILED'))
      console.error(err.message)

      console.error(
        chalk.red.bold('>>> Unable to read configuration file! Did you create the config.yml file?')
      )
      process.exit(1)
    }

    // Merge with defaults

    appconfig = toMerged(appdata.defaults.config, appconfig)

    // Override port

    if (appconfig.port < 1) {
      appconfig.port = process.env.PORT || 80
    }

    if (process.env.WIKI_PORT) {
      appconfig.port = process.env.WIKI_PORT || 80
    }

    // Load package info

    const packageInfo = JSON.parse(
      await fs.readFile(path.join(WIKI.SERVERPATH, 'package.json'), 'utf-8')
    )

    // Load DB Password from Docker Secret File
    if (process.env.DB_PASS_FILE) {
      if (!silent) {
        console.info(chalk.blue('DB_PASS_FILE is defined. Will use secret from file.'))
      }
      try {
        // FIXME: pre-existing bug — `.trim()` is called on the Promise rather than on the resolved
        // string, so this always throws and DB_PASS_FILE never works. Preserved as-is to keep the
        // TypeScript migration behavior-neutral; the fix is `(await fs.readFile(...)).trim()`.
        appconfig.db.pass = await (fs.readFile(process.env.DB_PASS_FILE, 'utf8') as any).trim()
      } catch (err: any) {
        console.error(
          chalk.red.bold(
            '>>> Failed to read Docker Secret File using path defined in DB_PASS_FILE env variable!'
          )
        )
        console.error(err.message)
        process.exit(1)
      }
    }

    WIKI.config = appconfig
    WIKI.data = appdata
    WIKI.version = packageInfo.version
    WIKI.releaseDate = packageInfo.releaseDate
    WIKI.devMode = packageInfo.dev === true
  },

  /**
   * Load config from DB
   */
  async loadFromDb(): Promise<boolean> {
    WIKI.logger.info('Loading settings from DB...')
    const conf = await WIKI.models.settings.getConfig()
    if (conf) {
      WIKI.config = toMerged(WIKI.config, conf)
      return true
    } else {
      return false
    }
  },
  /**
   * Save config to DB
   *
   * @param keys Array of keys to save
   * @returns Promise
   */
  async saveToDb(keys: string[], propagate = true): Promise<boolean> {
    try {
      for (const key of keys) {
        let value = WIKI.config[key] ?? null
        if (!isPlainObject(value)) {
          value = { v: value }
        }
        await WIKI.models.settings.updateConfig(key, value)
      }
      if (propagate) {
        WIKI.events.outbound.emit('reloadConfig')
      }
    } catch (err: any) {
      WIKI.logger.error(`Failed to save configuration to DB: ${err.message}`)
      return false
    }

    return true
  },
  /**
   * Initialize DB tables with default values
   */
  async initDbValues(): Promise<void> {
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
    await WIKI.models.jobs.init()
    await WIKI.models.icons.init()
  },
  /**
   * Subscribe to HA propagation events
   */
  subscribeToEvents(): void {
    WIKI.events.inbound.on('reloadConfig', async () => {
      await WIKI.configSvc.loadFromDb()
    })
  }
}
