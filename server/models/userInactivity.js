const { Model } = require('objection')

module.exports = class UserInactivity extends Model {
  static get tableName() {
    return 'userInactivity'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['userId', 'siteId'],
      properties: {
        id: { type: 'integer' },
        userId: { type: 'integer' },
        siteId: { type: 'string', format: 'uuid' },
        inactive_since: { type: 'string' }
      }
    }
  }

  static get relationMappings() {
    return {
      users: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'userInactivity.userId',
          to: 'users.id'
        }
      },
      sites: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./sites'),
        join: {
          from: 'userInactivity.siteId',
          to: 'sites.id'
        }
      }
    }
  }
}
