const Model = require('objection').Model
const fs = require('fs-extra')
const path = require('path')
const _ = require('lodash')
const yaml = require('js-yaml')
const commonHelper = require('../helpers/common')

/* global WIKI */

/**
 * Page Navigation module model
 */
module.exports = class PageNavigation extends Model {
  static get tableName () { return 'pageNavigation' }
  static get idColumn () { return 'key' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['key', 'isEnabled'],
      properties: {
        key: { type: 'string' },
        isEnabled: { type: 'boolean' }
      }
    }
  }

  static get jsonAttributes () {
    return ['config']
  }

  static async getProviders (isEnabled) {
    const providers = await WIKI.models.pageNavigation.query().where(_.isBoolean(isEnabled) ? { isEnabled } : {})
    return _.sortBy(providers, ['key'])
  }

  static async refreshProvidersFromDisk () {
    let trx
    try {
      const dbProviders = await WIKI.models.pageNavigation.query()

      const moduleDirs = await fs.readdir(path.join(WIKI.SERVERPATH, 'modules/page-navigation'))
      const diskProviders = []
      for (const dir of moduleDirs) {
        const defPath = path.join(WIKI.SERVERPATH, 'modules/page-navigation', dir, 'definition.yml')
        if (!await fs.pathExists(defPath)) {
          continue
        }
        const def = await fs.readFile(defPath, 'utf8')
        diskProviders.push(yaml.safeLoad(def))
      }

      WIKI.data.pageNavigationProviders = diskProviders.map(provider => ({
        ...provider,
        props: commonHelper.parseModuleProps(provider.props)
      }))

      const newProviders = []
      for (const provider of WIKI.data.pageNavigationProviders) {
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
          await WIKI.models.pageNavigation.query().patch({
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
        for (const provider of newProviders) {
          await WIKI.models.pageNavigation.query(trx).insert(provider)
        }
        await trx.commit()
        WIKI.logger.info(`Loaded ${newProviders.length} new page navigation providers: [ OK ]`)
      } else {
        WIKI.logger.info('No new page navigation providers found: [ SKIPPED ]')
      }
    } catch (err) {
      WIKI.logger.error('Failed to scan or load page navigation providers: [ FAILED ]')
      WIKI.logger.error(err)
      if (trx) {
        trx.rollback()
      }
    }
  }

  static async initModule () {
    const provider = await WIKI.models.pageNavigation.query().findOne({ key: 'page_navigation' })
    const providerInfo = _.find(WIKI.data.pageNavigationProviders, ['key', 'page_navigation']) || {}

    let css = ''
    const cssPath = path.join(WIKI.SERVERPATH, 'modules/page-navigation/page_navigation/assets/navigation.css')
    if (await fs.pathExists(cssPath)) {
      css = await fs.readFile(cssPath, 'utf8')
    }

    WIKI.data.pageNavigation = {
      ...providerInfo,
      isEnabled: provider ? provider.isEnabled : false,
      config: provider ? provider.config : {},
      css,
      resolve: require('../modules/page-navigation/page_navigation/navigation').resolve
    }
  }
}
