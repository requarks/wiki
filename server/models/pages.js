const Model = require('objection').Model
const _ = require('lodash')
const JSBinType = require('js-binary').Type
const pageHelper = require('../helpers/page')
const path = require('path')
const fs = require('fs-extra')

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
        hash: {type: 'string'},
        title: {type: 'string'},
        description: {type: 'string'},
        isPublished: {type: 'boolean'},
        privateNS: {type: 'string'},
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

  static get cacheSchema() {
    return new JSBinType({
      authorId: 'uint',
      authorName: 'string',
      createdAt: 'string',
      creatorId: 'uint',
      creatorName: 'string',
      description: 'string',
      isPrivate: 'boolean',
      isPublished: 'boolean',
      publishEndDate: 'string',
      publishStartDate: 'string',
      render: 'string',
      title: 'string',
      updatedAt: 'string'
    })
  }

  static async createPage(opts) {
    await WIKI.models.pages.query().insert({
      authorId: opts.authorId,
      content: opts.content,
      creatorId: opts.authorId,
      contentType: _.get(_.find(WIKI.data.editors, ['key', opts.editor]), `contentType`, 'text'),
      description: opts.description,
      editorKey: opts.editor,
      hash: pageHelper.generateHash({ path: opts.path, locale: opts.locale, privateNS: opts.isPrivate ? 'TODO' : '' }),
      isPrivate: opts.isPrivate,
      isPublished: opts.isPublished,
      localeCode: opts.locale,
      path: opts.path,
      publishEndDate: opts.publishEndDate,
      publishStartDate: opts.publishStartDate,
      title: opts.title
    })
    const page = await WIKI.models.pages.getPageFromDb({
      path: opts.path,
      locale: opts.locale,
      userId: opts.authorId,
      isPrivate: opts.isPrivate
    })
    await WIKI.models.pages.renderPage(page)
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
    await WIKI.models.pages.query().patch({
      authorId: opts.authorId,
      content: opts.content,
      description: opts.description,
      isPublished: opts.isPublished,
      publishEndDate: opts.publishEndDate,
      publishStartDate: opts.publishStartDate,
      title: opts.title
    }).where('id', ogPage.id)
    const page = await WIKI.models.pages.getPageFromDb({
      path: ogPage.path,
      locale: ogPage.localeCode,
      userId: ogPage.authorId,
      isPrivate: ogPage.isPrivate
    })
    await WIKI.models.pages.renderPage(page)
    await WIKI.models.storage.pageEvent({
      event: 'updated',
      page
    })
    return page
  }

  static async renderPage(page) {
    const pipeline = await WIKI.models.renderers.getRenderingPipeline(page.contentType)
    WIKI.queue.job.renderPage.add({
      page,
      pipeline
    }, {
      removeOnComplete: true,
      removeOnFail: true
    })
  }

  static async getPage(opts) {
    let page = await WIKI.models.pages.getPageFromCache(opts)
    if (!page) {
      page = await WIKI.models.pages.getPageFromDb(opts)
      await WIKI.models.pages.savePageToCache(page)
    }
    return page
  }

  static async getPageFromDb(opts) {
    const page = await WIKI.models.pages.query()
      .column([
        'pages.*',
        {
          authorName: 'author.name',
          creatorName: 'creator.name'
        }
      ])
      .joinRelation('author')
      .joinRelation('creator')
      .where({
        'pages.path': opts.path,
        'pages.localeCode': opts.locale
      })
      .andWhere(builder => {
        builder.where({
          'pages.isPublished': true
        }).orWhere({
          'pages.isPublished': false,
          'pages.authorId': opts.userId
        })
      })
      .andWhere(builder => {
        if (opts.isPrivate) {
          builder.where({ 'pages.isPrivate': true, 'pages.privateNS': opts.privateNS })
        } else {
          builder.where({ 'pages.isPrivate': false })
        }
      })
      .first()
    return page
  }

  static async savePageToCache(page) {
    const cachePath = path.join(process.cwd(), `data/cache/${page.hash}.bin`)
    await fs.outputFile(cachePath, WIKI.models.pages.cacheSchema.encode({
      authorId: page.authorId,
      authorName: page.authorName,
      createdAt: page.createdAt,
      creatorId: page.creatorId,
      creatorName: page.creatorName,
      description: page.description,
      isPrivate: page.isPrivate === 1,
      isPublished: page.isPublished === 1,
      publishEndDate: page.publishEndDate,
      publishStartDate: page.publishStartDate,
      render: page.render,
      title: page.title,
      updatedAt: page.updatedAt
    }))
  }

  static async getPageFromCache(opts) {
    const pageHash = pageHelper.generateHash({ path: opts.path, locale: opts.locale, privateNS: opts.isPrivate ? 'TODO' : '' })
    const cachePath = path.join(process.cwd(), `data/cache/${pageHash}.bin`)

    try {
      const pageBuffer = await fs.readFile(cachePath)
      let page = WIKI.models.pages.cacheSchema.decode(pageBuffer)
      return {
        ...page,
        path: opts.path,
        localeCode: opts.locale,
        isPrivate: opts.isPrivate
      }
    } catch (err) {
      if (err.code === 'ENOENT') {
        return false
      }
      WIKI.logger.error(err)
      throw err
    }
  }
}
