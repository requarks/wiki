const { Model } = require('objection')

/* global WIKI */

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

  static async initScheduler() {
    // To test every 1 minute, use 'PT1M'
    // For production, use 'P1D' (every 24h)
    WIKI.scheduler.registerJob({
      name: 'anonymize-inactive-users-job',
      immediate: false,
      schedule: 'P1D', // or 'PT1M' for testing
      repeat: true
    })
  }
}
