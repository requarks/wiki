const Model = require('objection').Model

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

  static async getTree() {
    const navTree = await WIKI.models.navigation.query().findOne('key', 'site')
    if (navTree) {
      return navTree.config
    } else {
      WIKI.logger.warn('Site Navigation is missing or corrupted.')
      return []
    }
  }
}
