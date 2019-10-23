const Model = require('objection').Model
const fs = require('fs-extra')
const path = require('path')
const _ = require('lodash')
const yaml = require('js-yaml')
const commonHelper = require('../helpers/common')

/* global WIKI */

/**
 * Analytics model
 */
module.exports = class Analytics extends Model {
  static get tableName() { return 'analytics' }
  static get idColumn() { return 'key' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['key', 'isEnabled'],

      properties: {
        key: {type: 'string'},
        isEnabled: {type: 'boolean'}
      }
    }
  }

  static get jsonAttributes() {
    return ['config']
  }

  static async getProviders(isEnabled) {
    const providers = await WIKI.models.analytics.query().where(_.isBoolean(isEnabled) ? { isEnabled } : {})
    return _.sortBy(providers, ['key'])
  }

  static async refreshProvidersFromDisk() {
    let trx
    try {
      const dbProviders = await WIKI.models.analytics.query()

      // -> Fetch definitions from disk
      const analyticsDirs = await fs.readdir(path.join(WIKI.SERVERPATH, 'modules/analytics'))
      let diskProviders = []
      for (let dir of analyticsDirs) {
        const def = await fs.readFile(path.join(WIKI.SERVERPATH, 'modules/analytics', dir, 'definition.yml'), 'utf8')
        diskProviders.push(yaml.safeLoad(def))
      }
      WIKI.data.analytics = diskProviders.map(provider => ({
        ...provider,
        props: commonHelper.parseModuleProps(provider.props)
      }))

      let newProviders = []
      for (let provider of WIKI.data.analytics) {
        if (!_.some(dbProviders, ['key', provider.key])) {
          newProviders.push({
            key: provider.key,
            isEnabled: false,
            config: _.transform(provider.props, (result, value, key) => {
              _.set(result, key, value.default)
              return result
            }, {})
          })
        } else {
          const providerConfig = _.get(_.find(dbProviders, ['key', provider.key]), 'config', {})
          await WIKI.models.analytics.query().patch({
            config: _.transform(provider.props, (result, value, key) => {
              if (!_.has(result, key)) {
                _.set(result, key, value.default)
              }
              return result
            }, providerConfig)
          }).where('key', provider.key)
        }
      }
      if (newProviders.length > 0) {
        trx = await WIKI.models.Objection.transaction.start(WIKI.models.knex)
        for (let provider of newProviders) {
          await WIKI.models.analytics.query(trx).insert(provider)
        }
        await trx.commit()
        WIKI.logger.info(`Loaded ${newProviders.length} new analytics providers: [ OK ]`)
      } else {
        WIKI.logger.info(`No new analytics providers found: [ SKIPPED ]`)
      }
    } catch (err) {
      WIKI.logger.error(`Failed to scan or load new analytics providers: [ FAILED ]`)
      WIKI.logger.error(err)
      if (trx) {
        trx.rollback()
      }
    }
  }

  static async getCode ({ cache = false } = {}) {
    if (cache) {
      const analyticsCached = await WIKI.cache.get('analytics')
      if (analyticsCached) {
        return analyticsCached
      }
    }
    try {
      const analyticsCode = {
        head: '',
        bodyStart: '',
        bodyEnd: ''
      }
      const providers = await WIKI.models.analytics.getProviders(true)

      for (let provider of providers) {
        const def = await fs.readFile(path.join(WIKI.SERVERPATH, 'modules/analytics', provider.key, 'code.yml'), 'utf8')
        let code = yaml.safeLoad(def)
        code.head = _.defaultTo(code.head, '')
        code.bodyStart = _.defaultTo(code.bodyStart, '')
        code.bodyEnd = _.defaultTo(code.bodyEnd, '')

        _.forOwn(provider.config, (value, key) => {
          code.head = _.replace(code.head, new RegExp(`{{${key}}}`, 'g'), value)
          code.bodyStart = _.replace(code.bodyStart, `{{${key}}}`, value)
          code.bodyEnd = _.replace(code.bodyEnd, `{{${key}}}`, value)
        })

        analyticsCode.head += code.head
        analyticsCode.bodyStart += code.bodyStart
        analyticsCode.bodyEnd += code.bodyEnd
      }

      await WIKI.cache.set('analytics', analyticsCode, 300)

      return analyticsCode
    } catch (err) {
      WIKI.logger.warn('Error while getting analytics code: ', err)
      return {
        head: '',
        bodyStart: '',
        bodyEnd: ''
      }
    }
  }
}
