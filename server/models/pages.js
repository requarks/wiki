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
      id: 'uint',
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
      toc: 'string',
      updatedAt: 'string'
    })
  }

  /**
   * Inject page metadata into contents
   */
  injectMetadata () {
    let meta = [
      ['title', this.title],
      ['description', this.description],
      ['published', this.isPublished.toString()],
      ['date', this.updatedAt],
      ['tags', '']
    ]
    switch (this.contentType) {
      case 'markdown':
        return '---\n' + meta.map(mt => `${mt[0]}: ${mt[1]}`).join('\n') + '\n---\n\n' + this.content
      case 'html':
        return '<!--\n' + meta.map(mt => `${mt[0]}: ${mt[1]}`).join('\n') + '\n-->\n\n' + this.content
      default:
        return this.content
    }
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
      publishEndDate: opts.publishEndDate || '',
      publishStartDate: opts.publishStartDate || '',
      title: opts.title,
      toc: '[]'
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
    await WIKI.models.pageHistory.addVersion({
      ...ogPage,
      action: 'updated'
    })
    await WIKI.models.pages.query().patch({
      authorId: opts.authorId,
      content: opts.content,
      description: opts.description,
      isPublished: opts.isPublished,
      publishEndDate: opts.publishEndDate || '',
      publishStartDate: opts.publishStartDate || '',
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

  static async deletePage(opts) {
    const page = await WIKI.models.pages.query().findById(opts.id)
    if (!page) {
      throw new Error('Invalid Page Id')
    }
    await WIKI.models.pageHistory.addVersion({
      ...page,
      action: 'deleted'
    })
    await WIKI.models.pages.query().delete().where('id', page.id)
    await WIKI.models.pages.deletePageFromCache(page)
    await WIKI.models.storage.pageEvent({
      event: 'deleted',
      page
    })
  }

  static async renderPage(page) {
    const renderJob = await WIKI.scheduler.registerJob({
      name: 'render-page',
      immediate: true,
      worker: true
    }, page.id)
    return renderJob.finished
  }

  static async getPage(opts) {
    let page = await WIKI.models.pages.getPageFromCache(opts)
    if (!page) {
      page = await WIKI.models.pages.getPageFromDb(opts)
      if (page) {
        await WIKI.models.pages.savePageToCache(page)
      }
    }
    return page
  }

  static async getPageFromDb(opts) {
    const queryModeID = _.isNumber(opts)
    return WIKI.models.pages.query()
      .column([
        'pages.*',
        {
          authorName: 'author.name',
          authorEmail: 'author.email',
          creatorName: 'creator.name',
          creatorEmail: 'creator.email'
        }
      ])
      .joinRelation('author')
      .joinRelation('creator')
      .where(queryModeID ? {
        'pages.id': opts
      } : {
        'pages.path': opts.path,
        'pages.localeCode': opts.locale
      })
      .andWhere(builder => {
        if (queryModeID) return
        builder.where({
          'pages.isPublished': true
        }).orWhere({
          'pages.isPublished': false,
          'pages.authorId': opts.userId
        })
      })
      .andWhere(builder => {
        if (queryModeID) return
        if (opts.isPrivate) {
          builder.where({ 'pages.isPrivate': true, 'pages.privateNS': opts.privateNS })
        } else {
          builder.where({ 'pages.isPrivate': false })
        }
      })
      .first()
  }

  static async savePageToCache(page) {
    const cachePath = path.join(process.cwd(), `data/cache/${page.hash}.bin`)
    await fs.outputFile(cachePath, WIKI.models.pages.cacheSchema.encode({
      id: page.id,
      authorId: page.authorId,
      authorName: page.authorName,
      createdAt: page.createdAt,
      creatorId: page.creatorId,
      creatorName: page.creatorName,
      description: page.description,
      isPrivate: page.isPrivate === 1 || page.isPrivate === true,
      isPublished: page.isPublished === 1 || page.isPublished === true,
      publishEndDate: page.publishEndDate,
      publishStartDate: page.publishStartDate,
      render: page.render,
      title: page.title,
      toc: _.isString(page.toc) ? page.toc : JSON.stringify(page.toc),
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

  static async deletePageFromCache(page) {
    return fs.remove(path.join(process.cwd(), `data/cache/${page.hash}.bin`))
  }
}
