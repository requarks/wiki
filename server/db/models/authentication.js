const Model = require('objection').Model
const autoload = require('auto-load')
const path = require('path')
const _ = require('lodash')
const commonHelper = require('../../helpers/common')

/* global WIKI */

/**
 * Authentication model
 */
module.exports = class Authentication extends Model {
  static get tableName() { return 'authentication' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['key', 'title', 'isEnabled', 'useForm'],

      properties: {
        id: {type: 'integer'},
        key: {type: 'string'},
        title: {type: 'string'},
        isEnabled: {type: 'boolean'},
        useForm: {type: 'boolean'},
        config: {type: 'object'},
        selfRegistration: {type: 'boolean'},
        domainWhitelist: {type: 'object'},
        autoEnrollGroups: {type: 'object'}
      }
    }
  }

  static async getStrategies() {
    const strategies = await WIKI.db.authentication.query()
    return strategies.map(str => ({
      ...str,
      domainWhitelist: _.get(str.domainWhitelist, 'v', []),
      autoEnrollGroups: _.get(str.autoEnrollGroups, 'v', [])
    }))
  }

  static async refreshStrategiesFromDisk() {
    try {
      const dbStrategies = await WIKI.db.authentication.query()
      const diskStrategies = autoload(path.join(WIKI.SERVERPATH, 'modules/authentication'))
      let newStrategies = []
      _.forOwn(diskStrategies, (strategy, strategyKey) => {
        if (!_.some(dbStrategies, ['key', strategy.key])) {
          newStrategies.push({
            key: strategy.key,
            title: strategy.title,
            isEnabled: false,
            useForm: strategy.useForm,
            config: _.transform(strategy.props, (result, value, key) => {
              if (_.isPlainObject(value)) {
                let cfgValue = {
                  type: typeof value.type(),
                  value: !_.isNil(value.default) ? value.default : commonHelper.getTypeDefaultValue(value)
                }
                if (_.isArray(value.enum)) {
                  cfgValue.enum = value.enum
                }
                _.set(result, key, cfgValue)
              } else {
                _.set(result, key, {
                  type: typeof value(),
                  value: commonHelper.getTypeDefaultValue(value)
                })
              }
              return result
            }, {}),
            selfRegistration: false,
            domainWhitelist: { v: [] },
            autoEnrollGroups: { v: [] }
          })
        }
      })
      if (newStrategies.length > 0) {
        await WIKI.db.authentication.query().insert(newStrategies)
        WIKI.logger.info(`Loaded ${newStrategies.length} new authentication strategies: [ OK ]`)
      } else {
        WIKI.logger.info(`No new authentication strategies found: [ SKIPPED ]`)
      }
    } catch (err) {
      WIKI.logger.error(`Failed to scan or load new authentication providers: [ FAILED ]`)
      WIKI.logger.error(err)
    }
  }
}
