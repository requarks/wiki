const Model = require('objection').Model
const fs = require('fs-extra')
const path = require('path')
const _ = require('lodash')
const yaml = require('js-yaml')
const commonHelper = require('../helpers/common')

/**
 * Analytics model
 */
module.exports = class Analytics extends Model {
  static get tableName() { return 'analytics' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['module', 'isEnabled'],

      properties: {
        id: { type: 'string' },
        module: { type: 'string' },
        isEnabled: { type: 'boolean', default: false }
      }
    }
  }

  static get jsonAttributes() {
    return ['config']
  }

  static async getProviders(isEnabled) {
    const providers = await WIKI.db.analytics.query().where(_.isBoolean(isEnabled) ? { isEnabled } : {})
    return _.sortBy(providers, ['module'])
  }

  static async refreshProvidersFromDisk() {
    try {
      // -> Fetch definitions from disk
      const analyticsDirs = await fs.readdir(path.join(WIKI.SERVERPATH, 'modules/analytics'))
      WIKI.data.analytics = []
      for (const dir of analyticsDirs) {
        const def = await fs.readFile(path.join(WIKI.SERVERPATH, 'modules/analytics', dir, 'definition.yml'), 'utf8')
        const defParsed = yaml.load(def)
        defParsed.key = dir
        defParsed.props = commonHelper.parseModuleProps(defParsed.props)
        WIKI.data.analytics.push(defParsed)
        WIKI.logger.debug(`Loaded analytics module definition ${dir}: [ OK ]`)
      }

      WIKI.logger.info(`Loaded ${WIKI.data.analytics.length} analytics module definitions: [ OK ]`)
    } catch (err) {
      WIKI.logger.error(`Failed to scan or load analytics providers: [ FAILED ]`)
      WIKI.logger.error(err)
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
      const providers = await WIKI.db.analytics.getProviders(true)

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
