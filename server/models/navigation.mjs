import { Model } from 'objection'
import { has } from 'lodash-es'

/**
 * Navigation model
 */
export class Navigation extends Model {
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

  static async getTree({ cache = false, locale = 'en', groups = [], bypassAuth = false } = {}) {
    if (cache) {
      const navTreeCached = await WIKI.cache.get(`nav:sidebar:${locale}`)
      if (navTreeCached) {
        return bypassAuth ? navTreeCached : WIKI.db.navigation.getAuthorizedItems(navTreeCached, groups)
      }
    }
    const navTree = await WIKI.db.navigation.query().findOne('key', `site`)
    if (navTree) {
      // Check for pre-2.3 format
      if (has(navTree.config[0], 'kind')) {
        navTree.config = [{
          locale: 'en',
          items: navTree.config.map(item => ({
            ...item,
            visibilityMode: 'all',
            visibilityGroups: []
          }))
        }]
      }

      for (const tree of navTree.config) {
        if (cache) {
          await WIKI.cache.set(`nav:sidebar:${tree.locale}`, tree.items, 300)
        }
      }
      if (bypassAuth) {
        return locale === 'all' ? navTree.config : WIKI.cache.get(`nav:sidebar:${locale}`)
      } else {
        return locale === 'all' ? WIKI.db.navigation.getAuthorizedItems(navTree.config, groups) : WIKI.db.navigation.getAuthorizedItems(WIKI.cache.get(`nav:sidebar:${locale}`), groups)
      }
    } else {
      WIKI.logger.warn('Site Navigation is missing or corrupted.')
      return []
    }
  }

  static getAuthorizedItems(tree = [], groups = []) {
    return tree.filter(leaf => {
      return leaf.visibilityMode === 'all' || _.intersection(leaf.visibilityGroups, groups).length > 0
    })
  }
}
