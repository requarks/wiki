import { Model } from 'objection'
import fs from 'node:fs/promises'
import path from 'node:path'
import { get } from 'lodash-es'
import yaml from 'js-yaml'
import { parseModuleProps } from '../helpers/common.mjs'

/**
 * Authentication model
 */
export class Authentication extends Model {
  static get tableName() { return 'authentication' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['module'],

      properties: {
        id: { type: 'string' },
        module: { type: 'string' },
        isEnabled: { type: 'boolean' },
        selfRegistration: {type: 'boolean'}
      }
    }
  }

  static get jsonAttributes() {
    return ['config', 'domainWhitelist', 'autoEnrollGroups']
  }

  static async getStrategy(key) {
    return WIKI.db.authentication.query().findOne({ key })
  }

  static async getStrategies({ enabledOnly = false } = {}) {
    const strategies = await WIKI.db.authentication.query().where(enabledOnly ? { isEnabled: true } : {})
    return strategies.map(str => ({
      ...str,
      domainWhitelist: get(str.domainWhitelist, 'v', []),
      autoEnrollGroups: get(str.autoEnrollGroups, 'v', [])
    }))
  }

  static async refreshStrategiesFromDisk() {
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
      WIKI.logger.error(`Failed to scan or load authentication providers: [ FAILED ]`)
      WIKI.logger.error(err)
    }
  }
}
