import fs from 'node:fs/promises'
import path from 'node:path'
import yaml from 'js-yaml'
import { parseModuleProps } from '../helpers/common.mjs'
import { authentication as authenticationTable } from '../db/schema.mjs'

/**
 * Authentication model
 */
class Authentication {
  async getStrategy (module) {
    return WIKI.db.authentication.query().findOne({ module })
  }

  async getStrategies ({ enabledOnly = false } = {}) {
    return WIKI.db.authentication.query().where(enabledOnly ? { isEnabled: true } : {})
  }

  async refreshStrategiesFromDisk () {
    try {
      // -> Fetch definitions from disk
      const authenticationDirs = await fs.readdir(path.join(WIKI.SERVERPATH, 'modules/authentication'))
      WIKI.data.authentication = []
      for (const dir of authenticationDirs) {
        const def = await fs.readFile(path.join(WIKI.SERVERPATH, 'modules/authentication', dir, 'definition.yml'), 'utf8')
        const defParsed = yaml.load(def)
        if (!defParsed.isAvailable) { continue }
        defParsed.key = dir
        defParsed.props = parseModuleProps(defParsed.props)
        WIKI.data.authentication.push(defParsed)
        WIKI.logger.debug(`Loaded authentication module definition ${dir}: [ OK ]`)
      }

      WIKI.logger.info(`Loaded ${WIKI.data.authentication.length} authentication module definitions: [ OK ]`)
    } catch (err) {
      WIKI.logger.error('Failed to scan or load authentication providers: [ FAILED ]')
      WIKI.logger.error(err)
    }
  }

  async init (ids) {
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
