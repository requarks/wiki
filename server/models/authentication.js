const Model = require('objection').Model
const fs = require('fs-extra')
const path = require('path')
const _ = require('lodash')
const yaml = require('js-yaml')
const commonHelper = require('../helpers/common')

/* global WIKI */

/**
 * Authentication model
 */
module.exports = class Authentication extends Model {
  static get tableName() { return 'authentication' }
  static get idColumn() { return 'key' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['key', 'isEnabled'],

      properties: {
        key: {type: 'string'},
        isEnabled: {type: 'boolean'},
        selfRegistration: {type: 'boolean'}
      }
    }
  }

  static get jsonAttributes() {
    return ['config', 'domainWhitelist', 'autoEnrollGroups']
  }

  static async getStrategy(key) {
    return WIKI.models.authentication.query().findOne({ key })
  }

  static async getStrategies(isEnabled) {
    const strategies = await WIKI.models.authentication.query().where(_.isBoolean(isEnabled) ? { isEnabled } : {})
    return _.sortBy(strategies.map(str => ({
      ...str,
      domainWhitelist: _.get(str.domainWhitelist, 'v', []),
      autoEnrollGroups: _.get(str.autoEnrollGroups, 'v', [])
    })), ['key'])
  }

  static async getStrategiesForLegacyClient() {
    const strategies = await WIKI.models.authentication.query().select('key', 'selfRegistration').where({ isEnabled: true })
    let formStrategies = []
    let socialStrategies = []

    for (let stg of strategies) {
      const stgInfo = _.find(WIKI.data.authentication, ['key', stg.key]) || {}
      if (stgInfo.useForm) {
        formStrategies.push({
          key: stg.key,
          title: stgInfo.title
        })
      } else {
        socialStrategies.push({
          ...stgInfo,
          ...stg,
          icon: await fs.readFile(path.join(WIKI.ROOTPATH, `assets/svg/auth-icon-${stg.key}.svg`), 'utf8').catch(err => {
            if (err.code === 'ENOENT') {
              return null
            }
            throw err
          })
        })
      }
    }

    return {
      formStrategies,
      socialStrategies
    }
  }

  static async refreshStrategiesFromDisk() {
    let trx
    try {
      const dbStrategies = await WIKI.models.authentication.query()

      // -> Fetch definitions from disk
      const authDirs = await fs.readdir(path.join(WIKI.SERVERPATH, 'modules/authentication'))
      let diskStrategies = []
      for (let dir of authDirs) {
        const def = await fs.readFile(path.join(WIKI.SERVERPATH, 'modules/authentication', dir, 'definition.yml'), 'utf8')
        diskStrategies.push(yaml.safeLoad(def))
      }
      WIKI.data.authentication = diskStrategies.map(strategy => ({
        ...strategy,
        props: commonHelper.parseModuleProps(strategy.props)
      }))

      let newStrategies = []
      for (let strategy of WIKI.data.authentication) {
        if (!_.some(dbStrategies, ['key', strategy.key])) {
          newStrategies.push({
            key: strategy.key,
            isEnabled: false,
            config: _.transform(strategy.props, (result, value, key) => {
              _.set(result, key, value.default)
              return result
            }, {}),
            selfRegistration: false,
            domainWhitelist: { v: [] },
            autoEnrollGroups: { v: [] }
          })
        } else {
          const strategyConfig = _.get(_.find(dbStrategies, ['key', strategy.key]), 'config', {})
          await WIKI.models.authentication.query().patch({
            config: _.transform(strategy.props, (result, value, key) => {
              if (!_.has(result, key)) {
                _.set(result, key, value.default)
              }
              return result
            }, strategyConfig)
          }).where('key', strategy.key)
        }
      }
      if (newStrategies.length > 0) {
        trx = await WIKI.models.Objection.transaction.start(WIKI.models.knex)
        for (let strategy of newStrategies) {
          await WIKI.models.authentication.query(trx).insert(strategy)
        }
        await trx.commit()
        WIKI.logger.info(`Loaded ${newStrategies.length} new authentication strategies: [ OK ]`)
      } else {
        WIKI.logger.info(`No new authentication strategies found: [ SKIPPED ]`)
      }
    } catch (err) {
      WIKI.logger.error(`Failed to scan or load new authentication providers: [ FAILED ]`)
      WIKI.logger.error(err)
      if (trx) {
        trx.rollback()
      }
    }
  }
}
