const Model = require('objection').Model
const _ = require('lodash')

/* global WIKI */

/**
 * Settings model
 */
module.exports = class Setting extends Model {
  static get tableName() { return 'settings' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['key', 'value'],

      properties: {
        id: {type: 'integer'},
        key: {type: 'string'},
        value: {type: 'object'},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  $beforeUpdate() {
    this.updatedAt = new Date().toISOString()
  }
  $beforeInsert() {
    this.updatedAt = new Date().toISOString()
  }

  static async getConfig() {
    const settings = await WIKI.db.settings.query()
    if (settings.length > 0) {
      return _.reduce(settings, (res, val, key) => {
        _.set(res, val.key, (val.value.v) ? val.value.v : val.value)
        return res
      }, {})
    } else {
      return false
    }
  }
}
