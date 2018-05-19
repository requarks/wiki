const Model = require('objection').Model

/**
 * Settings model
 */
module.exports = class User extends Model {
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
    this.createdAt = new Date().toISOString()
    this.updatedAt = new Date().toISOString()
  }
}
