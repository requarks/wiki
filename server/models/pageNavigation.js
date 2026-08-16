const Model = require('objection').Model
const fs = require('fs-extra')
const path = require('path')
const _ = require('lodash')
const yaml = require('js-yaml')
const commonHelper = require('../helpers/common')

/* global WIKI */

const MODULE_KEYS = {
  page_navigation: {
    resolvePath: '../modules/page-navigation/page_navigation/navigation',
    cssPath: 'page_navigation/assets/navigation.css'
  },
  related_pages: {
    resolvePath: '../modules/page-navigation/related_pages/relatedPages',
    cssPath: 'related_pages/assets/related-pages.css'
  },
  telegram_comments: {
    resolvePath: '../modules/page-navigation/telegram_comments/telegramComments',
    cssPath: null
  },
  iframe_embed: {
    resolvePath: '../modules/page-navigation/iframe_embed/iframeEmbed',
    cssPath: null
  }
}

function buildLegacyConfig (providerKey, legacyConfig = {}) {
  const config = {}
  if (providerKey === 'related_pages') {
    if (legacyConfig.pageGroupTagRegex) { config.pageGroupTagRegex = legacyConfig.pageGroupTagRegex }
    if (legacyConfig.disableNavTag) { config.disableNavTag = legacyConfig.disableNavTag }
    if (legacyConfig.relatedImageBaseUrl) { config.relatedImageBaseUrl = legacyConfig.relatedImageBaseUrl }
  }
  if (providerKey === 'telegram_comments') {
    if (legacyConfig.commentsAppWebsiteId) { config.commentsAppWebsiteId = legacyConfig.commentsAppWebsiteId }
    if (legacyConfig.commentsAppLimit) { config.commentsAppLimit = legacyConfig.commentsAppLimit }
  }
  return config
}

/**
 * Page Customization module model
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
      const legacyConfig = _.get(_.find(dbProviders, ['key', 'page_navigation']), 'config', {})

      const moduleDirs = await fs.readdir(path.join(WIKI.SERVERPATH, 'modules/page-navigation'))
      const diskProviders = []
      for (const dir of moduleDirs) {
        if (dir.startsWith('_')) {
          continue
        }
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
            isEnabled: true,
            config: _.transform(provider.props, (result, value, key) => {
              _.set(result, key, value.default)
              return result
            }, buildLegacyConfig(provider.key, legacyConfig))
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
        WIKI.logger.info(`Loaded ${newProviders.length} new page customization providers: [ OK ]`)
      } else {
        WIKI.logger.info('No new page customization providers found: [ SKIPPED ]')
      }
    } catch (err) {
      WIKI.logger.error('Failed to scan or load page customization providers: [ FAILED ]')
      WIKI.logger.error(err)
      if (trx) {
        trx.rollback()
      }
    }
  }

  static async loadProviderRuntime (key) {
    const meta = MODULE_KEYS[key]
    if (!meta) {
      return null
    }

    const provider = await WIKI.models.pageNavigation.query().findOne({ key })
    const providerInfo = _.find(WIKI.data.pageNavigationProviders, ['key', key]) || {}

    let css = ''
    if (meta.cssPath) {
      const cssPath = path.join(WIKI.SERVERPATH, 'modules/page-navigation', meta.cssPath)
      if (await fs.pathExists(cssPath)) {
        css = await fs.readFile(cssPath, 'utf8')
      }
    }

    const mod = require(meta.resolvePath)

    return {
      ...providerInfo,
      isEnabled: provider ? provider.isEnabled : false,
      config: provider ? provider.config : {},
      css,
      resolve: mod.resolve
    }
  }

  static async initModule () {
    WIKI.data.pageNavigation = await WIKI.models.pageNavigation.loadProviderRuntime('page_navigation')
    WIKI.data.relatedPages = await WIKI.models.pageNavigation.loadProviderRuntime('related_pages')
    WIKI.data.iframeEmbed = await WIKI.models.pageNavigation.loadProviderRuntime('iframe_embed')
    WIKI.data.telegramComments = await WIKI.models.pageNavigation.loadProviderRuntime('telegram_comments')
  }
}
