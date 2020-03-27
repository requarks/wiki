const Model = require('objection').Model
const _ = require('lodash')

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

  /**
   * Create Page Version
   */
  static async addVersion(opts) {
    await WIKI.models.pageHistory.query().insert({
      pageId: opts.id,
      authorId: opts.authorId,
      content: opts.content,
      contentType: opts.contentType,
      description: opts.description,
      editorKey: opts.editorKey,
      hash: opts.hash,
      isPrivate: (opts.isPrivate === true || opts.isPrivate === 1),
      isPublished: (opts.isPublished === true || opts.isPublished === 1),
      localeCode: opts.localeCode,
      path: opts.path,
      publishEndDate: opts.publishEndDate || '',
      publishStartDate: opts.publishStartDate || '',
      title: opts.title,
      action: opts.action || 'updated',
      versionDate: opts.versionDate
    })
  }

  /**
   * Get Page Version
   */
  static async getVersion({ pageId, versionId }) {
    const version = await WIKI.models.pageHistory.query()
      .column([
        'pageHistory.path',
        'pageHistory.title',
        'pageHistory.description',
        'pageHistory.isPrivate',
        'pageHistory.isPublished',
        'pageHistory.publishStartDate',
        'pageHistory.publishEndDate',
        'pageHistory.content',
        'pageHistory.contentType',
        'pageHistory.createdAt',
        'pageHistory.action',
        'pageHistory.authorId',
        'pageHistory.pageId',
        'pageHistory.versionDate',
        {
          versionId: 'pageHistory.id',
          editor: 'pageHistory.editorKey',
          locale: 'pageHistory.localeCode',
          authorName: 'author.name'
        }
      ])
      .joinRelated('author')
      .where({
        'pageHistory.id': versionId,
        'pageHistory.pageId': pageId
      }).first()
    if (version) {
      return {
        ...version,
        updatedAt: version.createdAt || null,
        tags: []
      }
    } else {
      return null
    }
  }

  /**
   * Get History Trail of a Page
   */
  static async getHistory({ pageId, offsetPage = 0, offsetSize = 100 }) {
    const history = await WIKI.models.pageHistory.query()
      .column([
        'pageHistory.id',
        'pageHistory.path',
        'pageHistory.authorId',
        'pageHistory.action',
        'pageHistory.versionDate',
        {
          authorName: 'author.name'
        }
      ])
      .joinRelated('author')
      .where({
        'pageHistory.pageId': pageId
      })
      .orderBy('pageHistory.versionDate', 'desc')
      .page(offsetPage, offsetSize)

    let prevPh = null
    const upperLimit = (offsetPage + 1) * offsetSize

    if (history.total >= upperLimit) {
      prevPh = await WIKI.models.pageHistory.query()
        .column([
          'pageHistory.id',
          'pageHistory.path',
          'pageHistory.authorId',
          'pageHistory.action',
          'pageHistory.versionDate',
          {
            authorName: 'author.name'
          }
        ])
        .joinRelated('author')
        .where({
          'pageHistory.pageId': pageId
        })
        .orderBy('pageHistory.versionDate', 'desc')
        .offset((offsetPage + 1) * offsetSize)
        .limit(1)
        .first()
    }

    return {
      trail: _.reduce(_.reverse(history.results), (res, ph) => {
        let actionType = 'edit'
        let valueBefore = null
        let valueAfter = null

        if (!prevPh && history.total < upperLimit) {
          actionType = 'initial'
        } else if (_.get(prevPh, 'path', '') !== ph.path) {
          actionType = 'move'
          valueBefore = _.get(prevPh, 'path', '')
          valueAfter = ph.path
        }

        res.unshift({
          versionId: ph.id,
          authorId: ph.authorId,
          authorName: ph.authorName,
          actionType,
          valueBefore,
          valueAfter,
          versionDate: ph.versionDate
        })

        prevPh = ph
        return res
      }, []),
      total: history.total
    }
  }
}
