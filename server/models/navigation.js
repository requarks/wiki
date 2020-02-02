const Model = require('objection').Model
const _ = require('lodash')

/* global WIKI */

/**
 * Navigation model
 */
module.exports = class Navigation extends Model {
  static get tableName() { return 'navigation' }
  static get idColumn() { return 'key' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['key'],

      properties: {
        key: {type: 'string'},
        config: {type: 'array', items: {type: 'object'}}
      }
    }
  }

  static async getTree({ cache = false, locale = 'en' } = {}) {
    if (cache) {
      const navTreeCached = await WIKI.cache.get(`nav:sidebar:${locale}`)
      if (navTreeCached) {
        return navTreeCached
      }
    }
    const navTree = await WIKI.models.navigation.query().findOne('key', 'site')
    if (navTree) {
      // Check for pre-2.1 format
      if (_.has(navTree.config[0], 'kind')) {
        navTree.config = [{
          locale: 'en',
          items: navTree.config
        }]
      }

      for (const tree of navTree.config) {
        if (cache) {
          await WIKI.cache.set(`nav:sidebar:${tree.locale}`, tree.items, 300)
        }
      }
      return locale === 'all' ? navTree.config : WIKI.cache.get(`nav:sidebar:${locale}`)
    } else {
      WIKI.logger.warn('Site Navigation is missing or corrupted.')
      return []
    }
  }
}
