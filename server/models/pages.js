const Model = require('objection').Model

/* global WIKI */

/**
 * Pages model
 */
module.exports = class Page extends Model {
  static get tableName() { return 'pages' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['path', 'title'],

      properties: {
        id: {type: 'integer'},
        path: {type: 'string'},
        title: {type: 'string'},
        description: {type: 'string'},
        isPublished: {type: 'boolean'},
        publishStartDate: {type: 'string'},
        publishEndDate: {type: 'string'},
        content: {type: 'string'},
        contentType: {type: 'string'},

        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  static get relationMappings() {
    return {
      tags: {
        relation: Model.ManyToManyRelation,
        modelClass: require('./tags'),
        join: {
          from: 'pages.id',
          through: {
            from: 'pageTags.pageId',
            to: 'pageTags.tagId'
          },
          to: 'tags.id'
        }
      },
      author: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'pages.authorId',
          to: 'users.id'
        }
      },
      creator: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./users'),
        join: {
          from: 'pages.creatorId',
          to: 'users.id'
        }
      },
      editor: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./editors'),
        join: {
          from: 'pages.editorKey',
          to: 'editors.key'
        }
      },
      locale: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./locales'),
        join: {
          from: 'pages.localeCode',
          to: 'locales.code'
        }
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

  static async createPage(opts) {
    const page = await WIKI.models.pages.query().insertAndFetch({
      authorId: opts.authorId,
      content: opts.content,
      creatorId: opts.authorId,
      description: opts.description,
      editorKey: opts.editor,
      isPrivate: opts.isPrivate,
      isPublished: opts.isPublished,
      localeCode: opts.locale,
      path: opts.path,
      publishEndDate: opts.publishEndDate,
      publishStartDate: opts.publishStartDate,
      title: opts.title
    })
    await WIKI.models.storage.pageEvent({
      event: 'created',
      page
    })
    return page
  }

  static async updatePage(opts) {
    const ogPage = await WIKI.models.pages.query().findById(opts.id)
    if (!ogPage) {
      throw new Error('Invalid Page Id')
    }
    await WIKI.models.pageHistory.addVersion(ogPage)
    const page = await WIKI.models.pages.query().patchAndFetchById(ogPage.id, {
      authorId: opts.authorId,
      content: opts.content,
      description: opts.description,
      isPublished: opts.isPublished,
      publishEndDate: opts.publishEndDate,
      publishStartDate: opts.publishStartDate,
      title: opts.title
    })
    await WIKI.models.storage.pageEvent({
      event: 'updated',
      page
    })
    return page
  }
}
