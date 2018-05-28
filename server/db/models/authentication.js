const Model = require('objection').Model
const autoload = require('auto-load')
const path = require('path')
const _ = require('lodash')

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
        config: {type: 'object'}
      }
    }
  }

  static async getEnabledStrategies() {
    return WIKI.db.authentication.query().where({ isEnabled: true })
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
            config: _.reduce(strategy.props, (result, value, key) => {
              _.set(result, value, '')
              return result
            }, {})
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
