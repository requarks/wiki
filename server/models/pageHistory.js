const Model = require('objection').Model

/* global WIKI */

/**
 * Page History model
 */
module.exports = class PageHistory extends Model {
  static get tableName() { return 'pageHistory' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['path', 'title'],

      properties: {
        id: {type: 'integer'},
        path: {type: 'string'},
        hash: {type: 'string'},
        title: {type: 'string'},
        description: {type: 'string'},
        isPublished: {type: 'boolean'},
        publishStartDate: {type: 'string'},
        publishEndDate: {type: 'string'},
        content: {type: 'string'},
        contentType: {type: 'string'},

        createdAt: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      tags: {
        relation: Model.ManyToManyRelation,
        modelClass: require('./tags'),
        join: {
          from: 'pageHistory.id',
          through: {
            from: 'pageHistoryTags.pageId',
            to: 'pageHistoryTags.tagId'
          },
          to: 'tags.id'
        }
      },
      page: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./pages'),
        join: {
          from: 'pageHistory.pageId',
          to: 'pages.id'
        }
      },
      author: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'pageHistory.authorId',
          to: 'users.id'
        }
      },
      editor: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./editors'),
        join: {
          from: 'pageHistory.editorKey',
          to: 'editors.key'
        }
      },
      locale: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./locales'),
        join: {
          from: 'pageHistory.localeCode',
          to: 'locales.code'
        }
      }
    }
  }

  $beforeInsert() {
    this.createdAt = new Date().toISOString()
  }

  static async addVersion(opts) {
    await WIKI.models.pageHistory.query().insert({
      pageId: opts.id,
      authorId: opts.authorId,
      content: opts.content,
      contentType: opts.contentType,
      description: opts.description,
      editorKey: opts.editorKey,
      hash: opts.hash,
      isPrivate: opts.isPrivate,
      isPublished: opts.isPublished,
      localeCode: opts.localeCode,
      path: opts.path,
      publishEndDate: opts.publishEndDate || '',
      publishStartDate: opts.publishStartDate || '',
      title: opts.title
    })
  }
}
