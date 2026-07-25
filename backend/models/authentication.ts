import fs from 'node:fs/promises'
import path from 'node:path'
import yaml from 'js-yaml'
import { eq } from 'drizzle-orm'
import { parseModuleProps } from '../helpers/common.ts'
import { authentication as authenticationTable } from '../db/schema.ts'
import type { SystemIds } from './types.ts'

/**
 * Authentication model
 */
class Authentication {
  async getStrategy(module: string) {
    return WIKI.db.select().from(authenticationTable).where(eq(authenticationTable.module, module))
  }

  async getStrategies({ enabledOnly = false }: { enabledOnly?: boolean } = {}) {
    return WIKI.db
      .select()
      .from(authenticationTable)
      .where(enabledOnly ? eq(authenticationTable.isEnabled, true) : undefined)
  }

  async refreshStrategiesFromDisk(): Promise<void> {
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
        const defParsed = yaml.load(def) as Record<string, any>
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
    } catch (err: any) {
      WIKI.logger.error('Failed to scan or load authentication module definitions [ FAILED ]')
      WIKI.logger.error(err)
    }
  }

  async activateStrategies(): Promise<void> {
    WIKI.logger.info('Activating authentication strategies...')

    // Unload any active strategies
    try {
      for (const strKey in WIKI.auth.strategies) {
        const strategy = WIKI.auth.strategies[strKey] as any
        if (typeof strategy.destroy === 'function') {
          await strategy.destroy()
        }
      }
    } catch (err: any) {
      WIKI.logger.warn(`Failed to unload active strategies [ FAILED ]`)
      WIKI.logger.warn(err)
    }
    WIKI.auth.strategies = {}

    // Load enabled strategies
    const enabledStrategies = await this.getStrategies({ enabledOnly: true })
    for (const stg of enabledStrategies) {
      try {
        const StrategyModule = (
          await import(`../modules/authentication/${stg.module}/authentication.ts`)
        ).default
        const strategy = new StrategyModule(stg.id, stg.config)
        WIKI.auth.strategies[stg.id] = strategy
        strategy.module = stg.module
        if (typeof strategy.init === 'function') {
          await strategy.init()
        }

        WIKI.logger.info(`Enabled authentication strategy ${stg.displayName} [ OK ]`)
      } catch (err: any) {
        WIKI.logger.error(
          `Failed to enable authentication strategy ${stg.displayName} (${stg.id}) [ FAILED ]`
        )
        WIKI.logger.error(err)
      }
    }
  }

  async init(ids: SystemIds): Promise<void> {
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
