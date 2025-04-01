const Model = require('objection').Model
/* global WIKI */
/**
 * User Mention model
 */
module.exports = class UserMentions extends Model {
  static get tableName() { return 'userMentions' }

  static get jsonSchema() {
    return {
      type: 'object',

      properties: {
        id: { type: 'integer' }
      }
    }
  }

  static get relationMappings() {
    return {
      page: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./pages'),
        join: {
          from: 'userMentions.pageId',
          to: 'pages.id'
        }
      },
      user: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'userMentions.userId',
          to: 'users.id'
        }
      },
      comment: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./comments'),
        join: {
          from: 'userMentions.commentId',
          to: 'comments.id'
        }
      }
    }
  }

  static getMentionedComments(userId) {
    return WIKI.models.userMentions.query().where('userId', userId).whereNotNull('commentId')
  }

  static getMentionedPages(userId) {
    return WIKI.models.userMentions.query().where('userId', userId).where(function () {
      this.whereNull('commentId')
    })
  }
}
