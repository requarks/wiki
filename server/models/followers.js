const { Model } = require('objection')

/**
 * Follower model
 */
module.exports = class Follower extends Model {
  static get tableName() { return 'followers' }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['userId', 'siteId'],

      properties: {
        id: { type: 'string' },
        userId: { type: 'integer' },
        siteId: { type: 'string' },
        pageId: { type: ['integer', 'null'] },
        createdAt: { type: 'string' }
      }
    }
  }

  static get relationMappings() {
    const Site = require('./sites')
    const Page = require('./pages')
    const User = require('./users')

    return {
      site: {
        relation: Model.BelongsToOneRelation,
        modelClass: Site,
        join: {
          from: 'followers.siteId',
          to: 'sites.id'
        }
      },
      page: {
        relation: Model.BelongsToOneRelation,
        modelClass: Page,
        join: {
          from: 'followers.pageId',
          to: 'pages.id'
        }
      },
      user: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'followers.userId',
          to: 'users.id'
        }
      }
    }
  }
}
