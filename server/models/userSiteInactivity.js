const { Model } = require('objection')

module.exports = class UserSiteInactivity extends Model {
  static get tableName() {
    return 'userSiteInactivity'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['userId', 'siteId'],
      properties: {
        id: { type: 'integer' },
        userId: { type: 'integer' },
        siteId: { type: 'string', format: 'uuid' },
        inactiveSince: { type: 'string' }
      }
    }
  }

  static get relationMappings() {
    return {
      users: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'userSiteInactivity.userId',
          to: 'users.id'
        }
      },
      sites: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./sites'),
        join: {
          from: 'userSiteInactivity.siteId',
          to: 'sites.id'
        }
      }
    }
  }
}
