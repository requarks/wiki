import { Model } from 'objection'
import { get, reduce, reverse } from 'lodash-es'
import { DateTime, Duration } from 'luxon'

import { Locale } from './locales.mjs'
import { Page } from './pages.mjs'
import { User } from './users.mjs'
import { Tag } from './tags.mjs'

/**
 * Page History model
 */
export class PageHistory extends Model {
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
        publishState: {type: 'string'},
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
        modelClass: Tag,
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
        modelClass: Page,
        join: {
          from: 'pageHistory.pageId',
          to: 'pages.id'
        }
      },
      author: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'pageHistory.authorId',
          to: 'users.id'
        }
      },
      locale: {
        relation: Model.BelongsToOneRelation,
        modelClass: Locale,
        join: {
          from: 'pageHistory.locale',
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
    await WIKI.db.pageHistory.query().insert({
      pageId: opts.id,
      siteId: opts.siteId,
      authorId: opts.authorId,
      content: opts.content,
      contentType: opts.contentType,
      description: opts.description,
      editor: opts.editor,
      hash: opts.hash,
      publishState: opts.publishState,
      locale: opts.locale,
      path: opts.path,
      publishEndDate: opts.publishEndDate?.toISO(),
      publishStartDate: opts.publishStartDate?.toISO(),
      title: opts.title,
      action: opts.action || 'updated',
      versionDate: opts.versionDate
    })
  }

  /**
   * Get Page Version
   */
  static async getVersion({ pageId, versionId }) {
    const version = await WIKI.db.pageHistory.query()
      .column([
        'pageHistory.path',
        'pageHistory.title',
        'pageHistory.description',
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
          locale: 'pageHistory.locale',
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
    const history = await WIKI.db.pageHistory.query()
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
      prevPh = await WIKI.db.pageHistory.query()
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
      trail: reduce(reverse(history.results), (res, ph) => {
        let actionType = 'edit'
        let valueBefore = null
        let valueAfter = null

        if (!prevPh && history.total < upperLimit) {
          actionType = 'initial'
        } else if (get(prevPh, 'path', '') !== ph.path) {
          actionType = 'move'
          valueBefore = get(prevPh, 'path', '')
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

  /**
   * Purge history older than X
   *
   * @param {String} olderThan ISO 8601 Duration
   */
  static async purge (olderThan) {
    const dur = Duration.fromISO(olderThan)
    const olderThanISO = DateTime.utc().minus(dur)
    await WIKI.db.pageHistory.query().where('versionDate', '<', olderThanISO.toISO()).del()
  }
}
