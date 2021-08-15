const Model = require('objection').Model
const _ = require('lodash')
const JSBinType = require('js-binary').Type
const pageHelper = require('../helpers/page')
const path = require('path')
const fs = require('fs-extra')
const yaml = require('js-yaml')
const striptags = require('striptags')
const emojiRegex = require('emoji-regex')
const he = require('he')
const CleanCSS = require('clean-css')
const TurndownService = require('turndown')
const turndownPluginGfm = require('@joplin/turndown-plugin-gfm').gfm
const cheerio = require('cheerio')

/* global WIKI */

const frontmatterRegex = {
  html: /^(<!-{2}(?:\n|\r)([\w\W]+?)(?:\n|\r)-{2}>)?(?:\n|\r)*([\w\W]*)*/,
  legacy: /^(<!-- TITLE: ?([\w\W]+?) ?-{2}>)?(?:\n|\r)?(<!-- SUBTITLE: ?([\w\W]+?) ?-{2}>)?(?:\n|\r)*([\w\W]*)*/i,
  markdown: /^(-{3}(?:\n|\r)([\w\W]+?)(?:\n|\r)-{3})?(?:\n|\r)*([\w\W]*)*/
}

const punctuationRegex = /[!,:;/\\_+\-=()&#@<>$~%^*[\]{}"'|]+|(\.\s)|(\s\.)/ig
// const htmlEntitiesRegex = /(&#[0-9]{3};)|(&#x[a-zA-Z0-9]{2};)/ig

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

  static get jsonAttributes() {
    return ['extra']
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
      links: {
        relation: Model.HasManyRelation,
        modelClass: require('./pageLinks'),
        join: {
          from: 'pages.id',
          to: 'pageLinks.pageId'
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
  /**
   * Solving the violates foreign key constraint using cascade strategy
   * using static hooks
   * @see https://vincit.github.io/objection.js/api/types/#type-statichookarguments
   */
  static async beforeDelete({ asFindQuery }) {
    const page = await asFindQuery().select('id')
    await WIKI.models.comments.query().delete().where('pageId', page[0].id)
  }
  /**
   * Cache Schema
   */
  static get cacheSchema() {
    return new JSBinType({
      id: 'uint',
      authorId: 'uint',
      authorName: 'string',
      createdAt: 'string',
      creatorId: 'uint',
      creatorName: 'string',
      description: 'string',
      editorKey: 'string',
      isPrivate: 'boolean',
      isPublished: 'boolean',
      publishEndDate: 'string',
      publishStartDate: 'string',
      render: 'string',
      tags: [
        {
          tag: 'string',
          title: 'string'
        }
      ],
      extra: {
        js: 'string',
        css: 'string'
      },
      title: 'string',
      toc: 'string',
      updatedAt: 'string'
    })
  }

  /**
   * Inject page metadata into contents
   *
   * @returns {string} Page Contents with Injected Metadata
   */
  injectMetadata () {
    return pageHelper.injectPageMetadata(this)
  }

  /**
   * Get the page's file extension based on content type
   *
   * @returns {string} File Extension
   */
  getFileExtension() {
    return pageHelper.getFileExtension(this.contentType)
  }

  /**
   * Parse injected page metadata from raw content
   *
   * @param {String} raw Raw file contents
   * @param {String} contentType Content Type
   * @returns {Object} Parsed Page Metadata with Raw Content
   */
  static parseMetadata (raw, contentType) {
    let result
    switch (contentType) {
      case 'markdown':
        result = frontmatterRegex.markdown.exec(raw)
        if (result[2]) {
          return {
            ...yaml.safeLoad(result[2]),
            content: result[3]
          }
        } else {
          // Attempt legacy v1 format
          result = frontmatterRegex.legacy.exec(raw)
          if (result[2]) {
            return {
              title: result[2],
              description: result[4],
              content: result[5]
            }
          }
        }
        break
      case 'html':
        result = frontmatterRegex.html.exec(raw)
        if (result[2]) {
          return {
            ...yaml.safeLoad(result[2]),
            content: result[3]
          }
        }
        break
    }
    return {
      content: raw
    }
  }

  /**
   * Create a New Page
   *
   * @param {Object} opts Page Properties
   * @returns {Promise} Promise of the Page Model Instance
   */
  static async createPage(opts) {
    // -> Validate path
    if (opts.path.includes('.') || opts.path.includes(' ') || opts.path.includes('\\') || opts.path.includes('//')) {
      throw new WIKI.Error.PageIllegalPath()
    }

    // -> Remove trailing slash
    if (opts.path.endsWith('/')) {
      opts.path = opts.path.slice(0, -1)
    }

    // -> Remove starting slash
    if (opts.path.startsWith('/')) {
      opts.path = opts.path.slice(1)
    }

    // -> Check for page access
    if (!WIKI.auth.checkAccess(opts.user, ['write:pages'], {
      locale: opts.locale,
      path: opts.path
    })) {
      throw new WIKI.Error.PageDeleteForbidden()
    }

    // -> Check for duplicate
    const dupCheck = await WIKI.models.pages.query().select('id').where('localeCode', opts.locale).where('path', opts.path).first()
    if (dupCheck) {
      throw new WIKI.Error.PageDuplicateCreate()
    }

    // -> Check for empty content
    if (!opts.content || _.trim(opts.content).length < 1) {
      throw new WIKI.Error.PageEmptyContent()
    }

    // -> Format CSS Scripts
    let scriptCss = ''
    if (WIKI.auth.checkAccess(opts.user, ['write:styles'], {
      locale: opts.locale,
      path: opts.path
    })) {
      if (!_.isEmpty(opts.scriptCss)) {
        scriptCss = new CleanCSS({ inline: false }).minify(opts.scriptCss).styles
      } else {
        scriptCss = ''
      }
    }

    // -> Format JS Scripts
    let scriptJs = ''
    if (WIKI.auth.checkAccess(opts.user, ['write:scripts'], {
      locale: opts.locale,
      path: opts.path
    })) {
      scriptJs = opts.scriptJs || ''
    }

    // -> Create page
    await WIKI.models.pages.query().insert({
      authorId: opts.user.id,
      content: opts.content,
      creatorId: opts.user.id,
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
      toc: '[]',
      extra: JSON.stringify({
        js: scriptJs,
        css: scriptCss
      })
    })
    const page = await WIKI.models.pages.getPageFromDb({
      path: opts.path,
      locale: opts.locale,
      userId: opts.user.id,
      isPrivate: opts.isPrivate
    })

    // -> Save Tags
    if (opts.tags && opts.tags.length > 0) {
      await WIKI.models.tags.associateTags({ tags: opts.tags, page })
    }

    // -> Render page to HTML
    await WIKI.models.pages.renderPage(page)

    // -> Rebuild page tree
    await WIKI.models.pages.rebuildTree()

    // -> Add to Search Index
    const pageContents = await WIKI.models.pages.query().findById(page.id).select('render')
    page.safeContent = WIKI.models.pages.cleanHTML(pageContents.render)
    await WIKI.data.searchEngine.created(page)

    // -> Add to Storage
    if (!opts.skipStorage) {
      await WIKI.models.storage.pageEvent({
        event: 'created',
        page
      })
    }

    // -> Reconnect Links
    await WIKI.models.pages.reconnectLinks({
      locale: page.localeCode,
      path: page.path,
      mode: 'create'
    })

    // -> Get latest updatedAt
    page.updatedAt = await WIKI.models.pages.query().findById(page.id).select('updatedAt').then(r => r.updatedAt)

    return page
  }

  /**
   * Update an Existing Page
   *
   * @param {Object} opts Page Properties
   * @returns {Promise} Promise of the Page Model Instance
   */
  static async updatePage(opts) {
    // -> Fetch original page
    const ogPage = await WIKI.models.pages.query().findById(opts.id)
    if (!ogPage) {
      throw new Error('Invalid Page Id')
    }

    // -> Check for page access
    if (!WIKI.auth.checkAccess(opts.user, ['write:pages'], {
      locale: opts.locale,
      path: opts.path
    })) {
      throw new WIKI.Error.PageUpdateForbidden()
    }

    // -> Check for empty content
    if (!opts.content || _.trim(opts.content).length < 1) {
      throw new WIKI.Error.PageEmptyContent()
    }

    // -> Create version snapshot
    await WIKI.models.pageHistory.addVersion({
      ...ogPage,
      isPublished: ogPage.isPublished === true || ogPage.isPublished === 1,
      action: opts.action ? opts.action : 'updated',
      versionDate: ogPage.updatedAt
    })

    // -> Format Extra Properties
    if (!_.isPlainObject(ogPage.extra)) {
      ogPage.extra = {}
    }

    // -> Format CSS Scripts
    let scriptCss = _.get(ogPage, 'extra.css', '')
    if (WIKI.auth.checkAccess(opts.user, ['write:styles'], {
      locale: opts.locale,
      path: opts.path
    })) {
      if (!_.isEmpty(opts.scriptCss)) {
        scriptCss = new CleanCSS({ inline: false }).minify(opts.scriptCss).styles
      } else {
        scriptCss = ''
      }
    }

    // -> Format JS Scripts
    let scriptJs = _.get(ogPage, 'extra.js', '')
    if (WIKI.auth.checkAccess(opts.user, ['write:scripts'], {
      locale: opts.locale,
      path: opts.path
    })) {
      scriptJs = opts.scriptJs || ''
    }

    // -> Update page
    await WIKI.models.pages.query().patch({
      authorId: opts.user.id,
      content: opts.content,
      description: opts.description,
      isPublished: opts.isPublished === true || opts.isPublished === 1,
      publishEndDate: opts.publishEndDate || '',
      publishStartDate: opts.publishStartDate || '',
      title: opts.title,
      extra: JSON.stringify({
        ...ogPage.extra,
        js: scriptJs,
        css: scriptCss
      })
    }).where('id', ogPage.id)
    let page = await WIKI.models.pages.getPageFromDb(ogPage.id)

    // -> Save Tags
    await WIKI.models.tags.associateTags({ tags: opts.tags, page })

    // -> Render page to HTML
    await WIKI.models.pages.renderPage(page)
    WIKI.events.outbound.emit('deletePageFromCache', page.hash)

    // -> Update Search Index
    const pageContents = await WIKI.models.pages.query().findById(page.id).select('render')
    page.safeContent = WIKI.models.pages.cleanHTML(pageContents.render)
    await WIKI.data.searchEngine.updated(page)

    // -> Update on Storage
    if (!opts.skipStorage) {
      await WIKI.models.storage.pageEvent({
        event: 'updated',
        page
      })
    }

    // -> Perform move?
    if ((opts.locale && opts.locale !== page.localeCode) || (opts.path && opts.path !== page.path)) {
      await WIKI.models.pages.movePage({
        id: page.id,
        destinationLocale: opts.locale,
        destinationPath: opts.path,
        user: opts.user
      })
    } else {
      // -> Update title of page tree entry
      await WIKI.models.knex.table('pageTree').where({
        pageId: page.id
      }).update('title', page.title)
    }

    // -> Get latest updatedAt
    page.updatedAt = await WIKI.models.pages.query().findById(page.id).select('updatedAt').then(r => r.updatedAt)

    return page
  }

  /**
   * Convert an Existing Page
   *
   * @param {Object} opts Page Properties
   * @returns {Promise} Promise of the Page Model Instance
   */
  static async convertPage(opts) {
    // -> Fetch original page
    const ogPage = await WIKI.models.pages.query().findById(opts.id)
    if (!ogPage) {
      throw new Error('Invalid Page Id')
    }

    if (ogPage.editorKey === opts.editor) {
      throw new Error('Page is already using this editor. Nothing to convert.')
    }

    // -> Check for page access
    if (!WIKI.auth.checkAccess(opts.user, ['write:pages'], {
      locale: ogPage.localeCode,
      path: ogPage.path
    })) {
      throw new WIKI.Error.PageUpdateForbidden()
    }

    // -> Check content type
    const sourceContentType = ogPage.contentType
    const targetContentType = _.get(_.find(WIKI.data.editors, ['key', opts.editor]), `contentType`, 'text')
    const shouldConvert = sourceContentType !== targetContentType
    let convertedContent = null

    // -> Convert content
    if (shouldConvert) {
      // -> Markdown => HTML
      if (sourceContentType === 'markdown' && targetContentType === 'html') {
        if (!ogPage.render) {
          throw new Error('Aborted conversion because rendered page content is empty!')
        }
        convertedContent = ogPage.render

        const $ = cheerio.load(convertedContent, {
          decodeEntities: true
        })

        if ($.root().children().length > 0) {
          // Remove header anchors
          $('.toc-anchor').remove()

          // Attempt to convert tabsets
          $('tabset').each((tabI, tabElm) => {
            const tabHeaders = []
            // -> Extract templates
            $(tabElm).children('template').each((tmplI, tmplElm) => {
              if ($(tmplElm).attr('v-slot:tabs') === '') {
                $(tabElm).before('<ul class="tabset-headers">' + $(tmplElm).html() + '</ul>')
              } else {
                $(tabElm).after('<div class="markdown-tabset">' + $(tmplElm).html() + '</div>')
              }
            })
            // -> Parse tab headers
            $(tabElm).prev('.tabset-headers').children((i, elm) => {
              tabHeaders.push($(elm).html())
            })
            $(tabElm).prev('.tabset-headers').remove()
            // -> Inject tab headers
            $(tabElm).next('.markdown-tabset').children((i, elm) => {
              if (tabHeaders.length > i) {
                $(elm).prepend(`<h2>${tabHeaders[i]}</h2>`)
              }
            })
            $(tabElm).next('.markdown-tabset').prepend('<h1>Tabset</h1>')
            $(tabElm).remove()
          })

          convertedContent = $.html('body').replace('<body>', '').replace('</body>', '').replace(/&#x([0-9a-f]{1,6});/ig, (entity, code) => {
            code = parseInt(code, 16)

            // Don't unescape ASCII characters, assuming they're encoded for a good reason
            if (code < 0x80) return entity

            return String.fromCodePoint(code)
          })
        }

      // -> HTML => Markdown
      } else if (sourceContentType === 'html' && targetContentType === 'markdown') {
        const td = new TurndownService({
          bulletListMarker: '-',
          codeBlockStyle: 'fenced',
          emDelimiter: '*',
          fence: '```',
          headingStyle: 'atx',
          hr: '---',
          linkStyle: 'inlined',
          preformattedCode: true,
          strongDelimiter: '**'
        })

        td.use(turndownPluginGfm)

        td.keep(['kbd'])

        td.addRule('subscript', {
          filter: ['sub'],
          replacement: c => `~${c}~`
        })

        td.addRule('superscript', {
          filter: ['sup'],
          replacement: c => `^${c}^`
        })

        td.addRule('underline', {
          filter: ['u'],
          replacement: c => `_${c}_`
        })

        td.addRule('taskList', {
          filter: (n, o) => {
            return n.nodeName === 'INPUT' && n.getAttribute('type') === 'checkbox'
          },
          replacement: (c, n) => {
            return n.getAttribute('checked') ? '[x] ' : '[ ] '
          }
        })

        td.addRule('removeTocAnchors', {
          filter: (n, o) => {
            return n.nodeName === 'A' && n.classList.contains('toc-anchor')
          },
          replacement: c => ''
        })

        convertedContent = td.turndown(ogPage.content)
      // -> Unsupported
      } else {
        throw new Error('Unsupported source / destination content types combination.')
      }
    }

    // -> Create version snapshot
    if (shouldConvert) {
      await WIKI.models.pageHistory.addVersion({
        ...ogPage,
        isPublished: ogPage.isPublished === true || ogPage.isPublished === 1,
        action: 'updated',
        versionDate: ogPage.updatedAt
      })
    }

    // -> Update page
    await WIKI.models.pages.query().patch({
      contentType: targetContentType,
      editorKey: opts.editor,
      ...(convertedContent ? { content: convertedContent } : {})
    }).where('id', ogPage.id)
    const page = await WIKI.models.pages.getPageFromDb(ogPage.id)

    await WIKI.models.pages.deletePageFromCache(page.hash)
    WIKI.events.outbound.emit('deletePageFromCache', page.hash)

    // -> Update on Storage
    await WIKI.models.storage.pageEvent({
      event: 'updated',
      page
    })
  }

  /**
   * Move a Page
   *
   * @param {Object} opts Page Properties
   * @returns {Promise} Promise with no value
   */
  static async movePage(opts) {
    let page
    if (_.has(opts, 'id')) {
      page = await WIKI.models.pages.query().findById(opts.id)
    } else {
      page = await WIKI.models.pages.query().findOne({
        path: opts.path,
        localeCode: opts.locale
      })
    }
    if (!page) {
      throw new WIKI.Error.PageNotFound()
    }

    // -> Validate path
    if (opts.destinationPath.includes('.') || opts.destinationPath.includes(' ') || opts.destinationPath.includes('\\') || opts.destinationPath.includes('//')) {
      throw new WIKI.Error.PageIllegalPath()
    }

    // -> Remove trailing slash
    if (opts.destinationPath.endsWith('/')) {
      opts.destinationPath = opts.destinationPath.slice(0, -1)
    }

    // -> Remove starting slash
    if (opts.destinationPath.startsWith('/')) {
      opts.destinationPath = opts.destinationPath.slice(1)
    }

    // -> Check for source page access
    if (!WIKI.auth.checkAccess(opts.user, ['manage:pages'], {
      locale: page.localeCode,
      path: page.path
    })) {
      throw new WIKI.Error.PageMoveForbidden()
    }
    // -> Check for destination page access
    if (!WIKI.auth.checkAccess(opts.user, ['write:pages'], {
      locale: opts.destinationLocale,
      path: opts.destinationPath
    })) {
      throw new WIKI.Error.PageMoveForbidden()
    }

    // -> Check for existing page at destination path
    const destPage = await WIKI.models.pages.query().findOne({
      path: opts.destinationPath,
      localeCode: opts.destinationLocale
    })
    if (destPage) {
      throw new WIKI.Error.PagePathCollision()
    }

    // -> Create version snapshot
    await WIKI.models.pageHistory.addVersion({
      ...page,
      action: 'moved',
      versionDate: page.updatedAt
    })

    const destinationHash = pageHelper.generateHash({ path: opts.destinationPath, locale: opts.destinationLocale, privateNS: opts.isPrivate ? 'TODO' : '' })

    // -> Move page
    const destinationTitle = (page.title === page.path ? opts.destinationPath : page.title)
    await WIKI.models.pages.query().patch({
      path: opts.destinationPath,
      localeCode: opts.destinationLocale,
      title: destinationTitle,
      hash: destinationHash
    }).findById(page.id)
    await WIKI.models.pages.deletePageFromCache(page.hash)
    WIKI.events.outbound.emit('deletePageFromCache', page.hash)

    // -> Rebuild page tree
    await WIKI.models.pages.rebuildTree()

    // -> Rename in Search Index
    const pageContents = await WIKI.models.pages.query().findById(page.id).select('render')
    page.safeContent = WIKI.models.pages.cleanHTML(pageContents.render)
    await WIKI.data.searchEngine.renamed({
      ...page,
      destinationPath: opts.destinationPath,
      destinationLocaleCode: opts.destinationLocale,
      destinationHash
    })

    // -> Rename in Storage
    if (!opts.skipStorage) {
      await WIKI.models.storage.pageEvent({
        event: 'renamed',
        page: {
          ...page,
          destinationPath: opts.destinationPath,
          destinationLocaleCode: opts.destinationLocale,
          destinationHash,
          moveAuthorId: opts.user.id,
          moveAuthorName: opts.user.name,
          moveAuthorEmail: opts.user.email
        }
      })
    }

    // -> Reconnect Links : Changing old links to the new path
    await WIKI.models.pages.reconnectLinks({
      sourceLocale: page.localeCode,
      sourcePath: page.path,
      locale: opts.destinationLocale,
      path: opts.destinationPath,
      mode: 'move'
    })

    // -> Reconnect Links : Validate invalid links to the new path
    await WIKI.models.pages.reconnectLinks({
      locale: opts.destinationLocale,
      path: opts.destinationPath,
      mode: 'create'
    })
  }

  /**
   * Delete an Existing Page
   *
   * @param {Object} opts Page Properties
   * @returns {Promise} Promise with no value
   */
  static async deletePage(opts) {
    let page
    if (_.has(opts, 'id')) {
      page = await WIKI.models.pages.query().findById(opts.id)
    } else {
      page = await WIKI.models.pages.query().findOne({
        path: opts.path,
        localeCode: opts.locale
      })
    }
    if (!page) {
      throw new WIKI.Error.PageNotFound()
    }

    // -> Check for page access
    if (!WIKI.auth.checkAccess(opts.user, ['delete:pages'], {
      locale: page.locale,
      path: page.path
    })) {
      throw new WIKI.Error.PageDeleteForbidden()
    }

    // -> Create version snapshot
    await WIKI.models.pageHistory.addVersion({
      ...page,
      action: 'deleted',
      versionDate: page.updatedAt
    })

    // -> Delete page
    await WIKI.models.pages.query().delete().where('id', page.id)
    await WIKI.models.pages.deletePageFromCache(page.hash)
    WIKI.events.outbound.emit('deletePageFromCache', page.hash)

    // -> Rebuild page tree
    await WIKI.models.pages.rebuildTree()

    // -> Delete from Search Index
    await WIKI.data.searchEngine.deleted(page)

    // -> Delete from Storage
    if (!opts.skipStorage) {
      await WIKI.models.storage.pageEvent({
        event: 'deleted',
        page
      })
    }

    // -> Reconnect Links
    await WIKI.models.pages.reconnectLinks({
      locale: page.localeCode,
      path: page.path,
      mode: 'delete'
    })
  }

  /**
   * Reconnect links to new/move/deleted page
   *
   * @param {Object} opts - Page parameters
   * @param {string} opts.path - Page Path
   * @param {string} opts.locale - Page Locale Code
   * @param {string} [opts.sourcePath] - Previous Page Path (move only)
   * @param {string} [opts.sourceLocale] - Previous Page Locale Code (move only)
   * @param {string} opts.mode - Page Update mode (create, move, delete)
   * @returns {Promise} Promise with no value
   */
  static async reconnectLinks (opts) {
    const pageHref = `/${opts.locale}/${opts.path}`
    let replaceArgs = {
      from: '',
      to: ''
    }
    switch (opts.mode) {
      case 'create':
        replaceArgs.from = `<a href="${pageHref}" class="is-internal-link is-invalid-page">`
        replaceArgs.to = `<a href="${pageHref}" class="is-internal-link is-valid-page">`
        break
      case 'move':
        const prevPageHref = `/${opts.sourceLocale}/${opts.sourcePath}`
        replaceArgs.from = `<a href="${prevPageHref}" class="is-internal-link is-valid-page">`
        replaceArgs.to = `<a href="${pageHref}" class="is-internal-link is-valid-page">`
        break
      case 'delete':
        replaceArgs.from = `<a href="${pageHref}" class="is-internal-link is-valid-page">`
        replaceArgs.to = `<a href="${pageHref}" class="is-internal-link is-invalid-page">`
        break
      default:
        return false
    }

    let affectedHashes = []
    // -> Perform replace and return affected page hashes (POSTGRES only)
    if (WIKI.config.db.type === 'postgres') {
      const qryHashes = await WIKI.models.pages.query()
        .returning('hash')
        .patch({
          render: WIKI.models.knex.raw('REPLACE(??, ?, ?)', ['render', replaceArgs.from, replaceArgs.to])
        })
        .whereIn('pages.id', function () {
          this.select('pageLinks.pageId').from('pageLinks').where({
            'pageLinks.path': opts.path,
            'pageLinks.localeCode': opts.locale
          })
        })
      affectedHashes = qryHashes.map(h => h.hash)
    } else {
      // -> Perform replace, then query affected page hashes (MYSQL, MARIADB, MSSQL, SQLITE only)
      await WIKI.models.pages.query()
        .patch({
          render: WIKI.models.knex.raw('REPLACE(??, ?, ?)', ['render', replaceArgs.from, replaceArgs.to])
        })
        .whereIn('pages.id', function () {
          this.select('pageLinks.pageId').from('pageLinks').where({
            'pageLinks.path': opts.path,
            'pageLinks.localeCode': opts.locale
          })
        })
      const qryHashes = await WIKI.models.pages.query()
        .column('hash')
        .whereIn('pages.id', function () {
          this.select('pageLinks.pageId').from('pageLinks').where({
            'pageLinks.path': opts.path,
            'pageLinks.localeCode': opts.locale
          })
        })
      affectedHashes = qryHashes.map(h => h.hash)
    }
    for (const hash of affectedHashes) {
      await WIKI.models.pages.deletePageFromCache(hash)
      WIKI.events.outbound.emit('deletePageFromCache', hash)
    }
  }

  /**
   * Rebuild page tree for new/updated/deleted page
   *
   * @returns {Promise} Promise with no value
   */
  static async rebuildTree() {
    const rebuildJob = await WIKI.scheduler.registerJob({
      name: 'rebuild-tree',
      immediate: true,
      worker: true
    })
    return rebuildJob.finished
  }

  /**
   * Trigger the rendering of a page
   *
   * @param {Object} page Page Model Instance
   * @returns {Promise} Promise with no value
   */
  static async renderPage(page) {
    const renderJob = await WIKI.scheduler.registerJob({
      name: 'render-page',
      immediate: true,
      worker: true
    }, page.id)
    return renderJob.finished
  }

  /**
   * Fetch an Existing Page from Cache if possible, from DB otherwise and save render to Cache
   *
   * @param {Object} opts Page Properties
   * @returns {Promise} Promise of the Page Model Instance
   */
  static async getPage(opts) {
    // -> Get from cache first
    let page = await WIKI.models.pages.getPageFromCache(opts)
    if (!page) {
      // -> Get from DB
      page = await WIKI.models.pages.getPageFromDb(opts)
      if (page) {
        if (page.render) {
          // -> Save render to cache
          await WIKI.models.pages.savePageToCache(page)
        } else {
          // -> No render? Possible duplicate issue
          /* TODO: Detect duplicate and delete */
          throw new Error('Error while fetching page. Duplicate entry detected. Reload the page to try again.')
        }
      }
    }
    return page
  }

  /**
   * Fetch an Existing Page from the Database
   *
   * @param {Object} opts Page Properties
   * @returns {Promise} Promise of the Page Model Instance
   */
  static async getPageFromDb(opts) {
    const queryModeID = _.isNumber(opts)
    try {
      return WIKI.models.pages.query()
        .column([
          'pages.id',
          'pages.path',
          'pages.hash',
          'pages.title',
          'pages.description',
          'pages.isPrivate',
          'pages.isPublished',
          'pages.privateNS',
          'pages.publishStartDate',
          'pages.publishEndDate',
          'pages.content',
          'pages.render',
          'pages.toc',
          'pages.contentType',
          'pages.createdAt',
          'pages.updatedAt',
          'pages.editorKey',
          'pages.localeCode',
          'pages.authorId',
          'pages.creatorId',
          'pages.extra',
          {
            authorName: 'author.name',
            authorEmail: 'author.email',
            creatorName: 'creator.name',
            creatorEmail: 'creator.email'
          }
        ])
        .joinRelated('author')
        .joinRelated('creator')
        .withGraphJoined('tags')
        .modifyGraph('tags', builder => {
          builder.select('tag', 'title')
        })
        .where(queryModeID ? {
          'pages.id': opts
        } : {
          'pages.path': opts.path,
          'pages.localeCode': opts.locale
        })
        // .andWhere(builder => {
        //   if (queryModeID) return
        //   builder.where({
        //     'pages.isPublished': true
        //   }).orWhere({
        //     'pages.isPublished': false,
        //     'pages.authorId': opts.userId
        //   })
        // })
        // .andWhere(builder => {
        //   if (queryModeID) return
        //   if (opts.isPrivate) {
        //     builder.where({ 'pages.isPrivate': true, 'pages.privateNS': opts.privateNS })
        //   } else {
        //     builder.where({ 'pages.isPrivate': false })
        //   }
        // })
        .first()
    } catch (err) {
      WIKI.logger.warn(err)
      throw err
    }
  }

  /**
   * Save a Page Model Instance to Cache
   *
   * @param {Object} page Page Model Instance
   * @returns {Promise} Promise with no value
   */
  static async savePageToCache(page) {
    const cachePath = path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache/${page.hash}.bin`)
    await fs.outputFile(cachePath, WIKI.models.pages.cacheSchema.encode({
      id: page.id,
      authorId: page.authorId,
      authorName: page.authorName,
      createdAt: page.createdAt,
      creatorId: page.creatorId,
      creatorName: page.creatorName,
      description: page.description,
      editorKey: page.editorKey,
      extra: {
        css: _.get(page, 'extra.css', ''),
        js: _.get(page, 'extra.js', '')
      },
      isPrivate: page.isPrivate === 1 || page.isPrivate === true,
      isPublished: page.isPublished === 1 || page.isPublished === true,
      publishEndDate: page.publishEndDate,
      publishStartDate: page.publishStartDate,
      render: page.render,
      tags: page.tags.map(t => _.pick(t, ['tag', 'title'])),
      title: page.title,
      toc: _.isString(page.toc) ? page.toc : JSON.stringify(page.toc),
      updatedAt: page.updatedAt
    }))
  }

  /**
   * Fetch an Existing Page from Cache
   *
   * @param {Object} opts Page Properties
   * @returns {Promise} Promise of the Page Model Instance
   */
  static async getPageFromCache(opts) {
    const pageHash = pageHelper.generateHash({ path: opts.path, locale: opts.locale, privateNS: opts.isPrivate ? 'TODO' : '' })
    const cachePath = path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache/${pageHash}.bin`)

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

  /**
   * Delete an Existing Page from Cache
   *
   * @param {String} page Page Unique Hash
   * @returns {Promise} Promise with no value
   */
  static async deletePageFromCache(hash) {
    return fs.remove(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache/${hash}.bin`))
  }

  /**
   * Flush the contents of the Cache
   */
  static async flushCache() {
    return fs.emptyDir(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache`))
  }

  /**
   * Migrate all pages from a source locale to the target locale
   *
   * @param {Object} opts Migration properties
   * @param {string} opts.sourceLocale Source Locale Code
   * @param {string} opts.targetLocale Target Locale Code
   * @returns {Promise} Promise with no value
   */
  static async migrateToLocale({ sourceLocale, targetLocale }) {
    return WIKI.models.pages.query()
      .patch({
        localeCode: targetLocale
      })
      .where({
        localeCode: sourceLocale
      })
      .whereNotExists(function() {
        this.select('id').from('pages AS pagesm').where('pagesm.localeCode', targetLocale).andWhereRaw('pagesm.path = pages.path')
      })
  }

  /**
   * Clean raw HTML from content for use in search engines
   *
   * @param {string} rawHTML Raw HTML
   * @returns {string} Cleaned Content Text
   */
  static cleanHTML(rawHTML = '') {
    let data = striptags(rawHTML || '', [], ' ')
      .replace(emojiRegex(), '')
      // .replace(htmlEntitiesRegex, '')
    return he.decode(data)
      .replace(punctuationRegex, ' ')
      .replace(/(\r\n|\n|\r)/gm, ' ')
      .replace(/\s\s+/g, ' ')
      .split(' ').filter(w => w.length > 1).join(' ').toLowerCase()
  }

  /**
   * Subscribe to HA propagation events
   */
  static subscribeToEvents() {
    WIKI.events.inbound.on('deletePageFromCache', hash => {
      WIKI.models.pages.deletePageFromCache(hash)
    })
    WIKI.events.inbound.on('flushCache', () => {
      WIKI.models.pages.flushCache()
    })
  }
}
