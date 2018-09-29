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
        config: {type: 'object'}
      }
    }
  }

  static async getTree() {
    return WIKI.models.navigation.query()
  }
}
