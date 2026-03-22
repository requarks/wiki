import fs from 'node:fs/promises'
import path from 'node:path'
import yaml from 'js-yaml'
import { eq } from 'drizzle-orm'
import { parseModuleProps } from '../helpers/common.js'
import { authentication as authenticationTable } from '../db/schema.js'

/**
 * Authentication model
 */
class Authentication {
  async getStrategy(module) {
    return WIKI.db.select().from(authenticationTable).where(eq(authenticationTable.module, module))
  }

  async getStrategies({ enabledOnly = false } = {}) {
    return WIKI.db
      .select()
      .from(authenticationTable)
      .where(enabledOnly ? eq(authenticationTable.isEnabled, true) : undefined)
  }

  async refreshStrategiesFromDisk() {
    try {
      // -> Fetch definitions from disk
      const authenticationDirs = await fs.readdir(
        path.join(WIKI.SERVERPATH, 'modules/authentication')
      )
      WIKI.data.authentication = []
      for (const dir of authenticationDirs) {
        const def = await fs.readFile(
          path.join(WIKI.SERVERPATH, 'modules/authentication', dir, 'definition.yml'),
          'utf8'
        )
        const defParsed = yaml.load(def)
        if (!defParsed.isAvailable) {
          continue
        }
        defParsed.key = dir
        defParsed.props = parseModuleProps(defParsed.props)
        WIKI.data.authentication.push(defParsed)
        WIKI.logger.debug(`Loaded authentication module definition ${dir} [ OK ]`)
      }

      WIKI.logger.info(
        `Loaded ${WIKI.data.authentication.length} authentication module definitions [ OK ]`
      )
    } catch (err) {
      WIKI.logger.error('Failed to scan or load authentication module definitions [ FAILED ]')
      WIKI.logger.error(err)
    }
  }

  async activateStrategies() {
    WIKI.logger.info('Activating authentication strategies...')

    // Unload any active strategies
    try {
      for (strKey in WIKI.auth.strategies) {
        if (typeof WIKI.auth.strategies[strKey].destroy === 'function') {
          await WIKI.auth.strategies[strKey].destroy()
        }
      }
    } catch (err) {
      WIKI.logger.warn(`Failed to unload active strategies [ FAILED ]`)
      WIKI.logger.warn(err)
    }
    WIKI.auth.strategies = {}

    // Load enabled strategies
    const enabledStrategies = await this.getStrategies({ enabledOnly: true })
    for (const stg of enabledStrategies) {
      try {
        const StrategyModule = (
          await import(`../modules/authentication/${stg.module}/authentication.js`)
        ).default
        WIKI.auth.strategies[stg.id] = new StrategyModule(stg.id, stg.config)
        WIKI.auth.strategies[stg.id].module = stg.module
        if (typeof WIKI.auth.strategies[stg.id].init === 'function') {
          await WIKI.auth.strategies[stg.id].init()
        }

        WIKI.logger.info(`Enabled authentication strategy ${stg.displayName} [ OK ]`)
      } catch (err) {
        WIKI.logger.error(
          `Failed to enable authentication strategy ${stg.displayName} (${stg.id}) [ FAILED ]`
        )
        WIKI.logger.error(err)
      }
    }
  }

  async init(ids) {
    await WIKI.db.insert(authenticationTable).values({
      id: ids.authModuleId,
      module: 'local',
      isEnabled: true,
      displayName: 'Local Authentication',
      config: {
        emailValidation: true,
        enforceTfa: false
      }
    })
  }
}

export const authentication = new Authentication()
