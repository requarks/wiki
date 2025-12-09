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
  legacy:
    /^(<!-- TITLE: ?([\w\W]+?) ?-{2}>)?(?:\n|\r)?(<!-- SUBTITLE: ?([\w\W]+?) ?-{2}>)?(?:\n|\r)*([\w\W]*)*/i,
  markdown: /^(-{3}(?:\n|\r)([\w\W]+?)(?:\n|\r)-{3})?(?:\n|\r)*([\w\W]*)*/
}

const punctuationRegex = /[!,:;/\\_+\-=()&#@<>$~%^*[\]{}"'|]+|(\.\s)|(\s\.)/gi
// const htmlEntitiesRegex = /(&#[0-9]{3};)|(&#x[a-zA-Z0-9]{2};)/ig

/**
 * Pages model
 */

function checkAccess(user, perms, params, error) {
  if (!WIKI.auth.checkAccess(user, perms, params)) {
    throw new WIKI.Error[error]()
  }
}

function getScriptCss(ogPage, opts) {
  if (
    WIKI.auth.checkAccess(opts.user, ['write:styles'], {
      locale: opts.locale,
      path: opts.path,
      siteId: opts.siteId
    })
  ) {
    if (!_.isEmpty(opts.scriptCss)) {
      return new CleanCSS({ inline: false }).minify(opts.scriptCss).styles
    }
    return ''
  }
  return _.get(ogPage, 'extra.css', '')
}

module.exports = class Page extends Model {
  static get tableName() {
    return 'pages'
  }

  static get jsonSchema() {
    return {
      type: 'object',
      required: ['path', 'title'],

      properties: {
        id: { type: 'integer' },
        path: { type: 'string' },
        hash: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        isPublished: { type: 'boolean' },
        privateNS: { type: 'string' },
        publishStartDate: { type: 'string' },
        publishEndDate: { type: 'string' },
        content: { type: 'string' },
        contentType: { type: 'string' },
        siteId: { type: 'string' },

        createdAt: { type: 'string' },
        updatedAt: { type: 'string' }
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
      mentions: {
        relation: Model.HasManyRelation,
        modelClass: require('./userMentions'),
        join: {
          from: 'pages.id',
          to: 'userMentions.pageId'
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
      },
      site: {
        relation: Model.BelongsToOneRelation,
        modelClass: require('./sites'),
        join: {
          from: 'pages.siteId',
          to: 'sites.id'
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
      contentType: 'string',
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
      updatedAt: 'string',
      siteId: 'string'
    })
  }

  /**
   * Inject page metadata into contents
   *
   * @returns {string} Page Contents with Injected Metadata
   */
  injectMetadata() {
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
  static parseMetadata(raw, contentType) {
    let result
    try {
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
    } catch (err) {
      WIKI.logger.warn('Failed to parse page metadata. Invalid syntax.')
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
    // Replace all "." with "-" to simplify the path format for the end user
    opts.path = opts.path.replace(/\./g, '-')
    // -> Validate path
    if (
      opts.path.includes('.') ||
      opts.path.includes(' ') ||
      opts.path.includes('\\') ||
      opts.path.includes('//')
    ) {
      throw new WIKI.Error.PageIllegalPath()
    }
    // -> Remove trailing slash
    if (opts.path.endsWith('/')) opts.path = opts.path.slice(0, -1)
    // -> Remove starting slash
    if (opts.path.startsWith('/')) opts.path = opts.path.slice(1)
    // -> Check for page access
    checkAccess(opts.user, ['write:pages'], {
      locale: opts.locale,
      path: opts.path,
      siteId: opts.siteId
    }, 'PageDeleteForbidden')

    // -> Check for duplicate
    const dupCheck = await WIKI.models.pages
      .query()
      .select('id')
      .where('localeCode', opts.locale)
      .where('path', opts.path)
      .where('siteId', opts.siteId)
      .first()
    if (dupCheck) throw new WIKI.Error.PageDuplicateCreate()
    if (!opts.content || _.trim(opts.content).length < 1) throw new WIKI.Error.PageEmptyContent()
    // -> Format CSS Scripts
    let scriptCss = getScriptCss({}, opts)
    // -> Format JS Scripts
    let scriptJs = ''
    const pageHash = await WIKI.models.pages.generatePageHash(
      opts.siteId,
      opts.path,
      opts.locale,
      opts.isPrivate
    )
    // -> Create page
    await WIKI.models.pages.query().insert({
      authorId: opts.user.id,
      content: opts.content,
      creatorId: opts.user.id,
      contentType: _.get(
        _.find(WIKI.data.editors, ['key', opts.editor]),
        `contentType`,
        'text'
      ),
      description: opts.description,
      editorKey: opts.editor,
      hash: pageHash,
      isPrivate: opts.isPrivate,
      isPublished: opts.isPublished,
      localeCode: opts.locale,
      path: opts.path,
      publishEndDate: opts.publishEndDate || '',
      publishStartDate: opts.publishStartDate || '',
      title: opts.title,
      toc: '[]',
      extra: JSON.stringify({ js: scriptJs, css: scriptCss }),
      siteId: opts.siteId
    })

    const page = await WIKI.models.pages.getPageFromDb({
      path: opts.path,
      locale: opts.locale,
      userId: opts.user.id,
      isPrivate: opts.isPrivate,
      siteId: opts.siteId
    })

    // -> Save Tags
    if (opts.tags && opts.tags.length > 0) {
      await WIKI.models.tags.associateTags({ tags: opts.tags, page })
    }
    await Promise.all([
      WIKI.models.pages.renderPage(page),
      WIKI.models.pages.rebuildTree(page, 'create')
    ])

    await Promise.all([
      (async () => {
        const pageContents = await WIKI.models.pages.query().findById(page.id).select('render')
        page.safeContent = WIKI.models.pages.cleanHTML(pageContents.render)
        await WIKI.data.searchEngine.created(page)
      })(),
      (!opts.skipStorage ? WIKI.models.storage.pageEvent({ event: 'created', page }) : null),
      WIKI.models.pages.reconnectLinks({
        siteId: page.siteId,
        locale: page.localeCode,
        path: page.path,
        mode: 'create'
      })
    ].filter(Boolean))

    // -> Get latest updatedAt
    page.updatedAt = await WIKI.models.pages
      .query()
      .findById(page.id)
      .select('updatedAt')
      .then((r) => r.updatedAt)

    return page
  }

  /**
   * Update an Existing Page
   *
   * @param {Object} opts Page Properties
   * @returns {Promise} Promise of the Page Model Instance
   */
  static async updatePage(opts) {
    // Helper: Move page if needed
    async function movePageIfPathOrLocaleChanged(page, opts) {
      if ((opts.locale && opts.locale !== page.localeCode) || (opts.path && opts.path !== page.path)) {
        checkAccess(opts.user, ['write:pages'], {
          locale: opts.locale,
          path: opts.path,
          siteId: opts.siteId
        }, 'PageMoveForbidden')
        await WIKI.models.pages.movePage({
          id: page.id,
          destinationLocale: opts.locale,
          destinationPath: opts.path,
          user: opts.user
        })
      } else {
        await WIKI.models.knex
          .table('pageTree')
          .where({ pageId: page.id })
          .update('title', page.title)
      }
    }

    // -> Fetch original page
    const ogPage = await WIKI.models.pages.query().findById(opts.id)
    if (!ogPage) throw new Error('Invalid Page Id')

    checkAccess(opts.user, ['write:pages'], {
      locale: ogPage.localeCode,
      path: ogPage.path,
      siteId: opts.siteId
    }, 'PageUpdateForbidden')

    if (!opts.content || _.trim(opts.content).length < 1) throw new WIKI.Error.PageEmptyContent()

    // -> Create version snapshot
    await WIKI.models.pageHistory.addVersion({
      ...ogPage,
      isPublished: ogPage.isPublished === true || ogPage.isPublished === 1,
      action: opts.action ? opts.action : 'updated',
      versionDate: ogPage.updatedAt,
      siteId: ogPage.siteId
    })

    if (!_.isPlainObject(ogPage.extra)) ogPage.extra = {}
    let scriptCss = getScriptCss(ogPage, opts)
    let scriptJs = _.get(ogPage, 'extra.js', '')

    // -> Update page
    await WIKI.models.pages
      .query()
      .patch({
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
        }),
        siteId: ogPage.siteId
      })
      .where('id', ogPage.id)
    let page = await WIKI.models.pages.getPageFromDb(ogPage.id)

    // -> Save Tags
    await WIKI.models.tags.associateTags({
      tags: Array.isArray(opts.tags) ? opts.tags : [],
      page
    })
    // -> Render page to HTML
    await WIKI.models.pages.renderPage(page)
    WIKI.events.outbound.emit('deletePageFromCache', page.hash)

    await Promise.all([
      (async () => {
        const pageContents = await WIKI.models.pages.query().findById(page.id).select('render')
        page.safeContent = WIKI.models.pages.cleanHTML(pageContents.render)
        await WIKI.data.searchEngine.updated(page)
      })(),
      (!opts.skipStorage ? WIKI.models.storage.pageEvent({ event: 'updated', page }) : null)
    ].filter(Boolean))

    await movePageIfPathOrLocaleChanged(page, opts)
    // -> Get latest updatedAt
    page.updatedAt = await WIKI.models.pages
      .query()
      .findById(page.id)
      .select('updatedAt')
      .then((r) => r.updatedAt)

    return page
  }

  /**
   * Get the page tree starting from a given page
   * @param {number} siteId
   * @param {number} pageId
   * @returns {Object[]} Page Tree List
   */
  static async getPageTreeFrom(siteId, pageId) {
    return WIKI.models.knex
      .select('pages.id', 'pages.path', 'pages.title', 'pages.contentType', 'pages.render', 'pages.content', 'pages.localeCode', 'pages.siteId')
      .from('pages')
      .join('pageTree', 'pages.id', 'pageTree.pageId')
      .where('pageTree.siteId', siteId)
      .whereRaw(`"ancestors"::jsonb @> (SELECT ('[' || "id" || ']')::jsonb FROM "pageTree" WHERE "pageId" = ?)`, [pageId])
      .orWhere('pages.id', pageId)
      .orderBy('pages.path')
  }

  /**
   * Converts all diagram elements from a markdown page into diagram elements required by the visual editor
   * @param {Page} pageData
   * @returns {String}
   */
  static convertDiagramElements(pageData) {
    let markdownContent = pageData.content
    let htmlContent = pageData.render
    let htmlWithConvertedDiagrams = htmlContent

    let diagramStartIdx = 0
    let diagramEndIdx = 0
    let svgStartIdx = 0
    let svgEndIdx = 0

    let diagramElem = ''
    let svgElem = ''
    let convertedElem = ''

    while (diagramStartIdx !== -1 && diagramEndIdx !== -1 && svgStartIdx !== -1 && svgEndIdx !== -1) {
      diagramStartIdx = markdownContent.indexOf('```diagram\n') + '```diagram\n'.length
      diagramEndIdx = markdownContent.indexOf('```', diagramStartIdx)
      svgStartIdx = htmlContent.indexOf('<svg ')
      svgEndIdx = htmlContent.indexOf('</svg>') + '</svg>'.length

      if (diagramStartIdx !== -1 && diagramEndIdx !== -1 && svgStartIdx !== -1 && svgEndIdx !== -1) {
        diagramElem = markdownContent.substring(diagramStartIdx, diagramEndIdx)
        svgElem = htmlContent.substring(svgStartIdx, svgEndIdx)

        convertedElem = Page.convertSingleDiagramElement(diagramElem)
        if (convertedElem !== '') {
          htmlWithConvertedDiagrams = htmlWithConvertedDiagrams.replace(svgElem, convertedElem)
        }
        markdownContent = markdownContent.substring(diagramEndIdx + 1)
        htmlContent = htmlContent.substring(svgEndIdx + 1)
      }
    }

    return htmlWithConvertedDiagrams
  }

  /**
   * Converts a single diagram element (as is required by the visual editor) based on the element given as input
   * @param {String} diagramElem
   * @returns {String} HTML of the diagram element OR empty string, if no SVG element was found
   */
  static convertSingleDiagramElement(diagramElem) {
    const $ = cheerio.load(diagramElem)
    const $svg = $('.diagram')?.find('svg')
    if (!$svg) {
      throw new Error('Did not find SVG element to convert.')
    }

    return `<img src="data:image/svg+xml;base64,${diagramElem}">`
  }

  /**
   * Convert Markdown to HTML
   * @param {Page} ogPage
   * @returns {String} HTML Content
   *
   * @throws {Error} If rendered page content is empty
   */
  static convertMarkdown2HTML(ogPage) {
    if (!ogPage.render) {
      throw new Error(
        'Aborted conversion because rendered page content is empty!'
      )
    }
    let convertedContent = Page.convertDiagramElements(ogPage)

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
        $(tabElm)
          .children('template')
          .each((tmplI, tmplElm) => {
            if ($(tmplElm).attr('v-slot:tabs') === '') {
              $(tabElm).before(
                '<ul class="tabset-headers">' + $(tmplElm).html() + '</ul>'
              )
            } else {
              $(tabElm).after(
                '<div class="markdown-tabset">' +
                $(tmplElm).html() +
                '</div>'
              )
            }
          })
        // -> Parse tab headers
        $(tabElm)
          .prev('.tabset-headers')
          .children((i, elm) => {
            tabHeaders.push($(elm).html())
          })
        $(tabElm).prev('.tabset-headers').remove()
        // -> Inject tab headers
        $(tabElm)
          .next('.markdown-tabset')
          .children((i, elm) => {
            if (tabHeaders.length > i) {
              $(elm).prepend(`<h2>${tabHeaders[i]}</h2>`)
            }
          })
        $(tabElm).next('.markdown-tabset').prepend('<h1>Tabset</h1>')
        $(tabElm).remove()
      })

      convertedContent = $.html('body')
        .replace('<body>', '')
        .replace('</body>', '')
        .replace(/&#x([0-9a-f]{1,6});/gi, (entity, code) => {
          code = parseInt(code, 16)

          // Don't unescape ASCII characters, assuming they're encoded for a good reason
          if (code < 0x80) return entity

          return String.fromCodePoint(code)
        })
    }
    return convertedContent
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
    if (
      !WIKI.auth.checkAccess(opts.user, ['write:pages'], {
        locale: ogPage.localeCode,
        path: ogPage.path,
        siteId: ogPage.siteId
      })
    ) {
      throw new WIKI.Error.PageUpdateForbidden()
    }

    // -> Check content type
    const sourceContentType = ogPage.contentType
    const targetContentType = _.get(
      _.find(WIKI.data.editors, ['key', opts.editor]),
      `contentType`,
      'text'
    )
    const shouldConvert = sourceContentType !== targetContentType
    let convertedContent = null

    // -> Convert content
    if (shouldConvert) {
      // -> Markdown => HTML
      if (sourceContentType === 'markdown' && targetContentType === 'html') {
        convertedContent = Page.convertMarkdown2HTML(ogPage)

        // -> HTML => Markdown
      } else if (
        sourceContentType === 'html' &&
        targetContentType === 'markdown'
      ) {
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
          replacement: (c) => `~${c}~`
        })

        td.addRule('superscript', {
          filter: ['sup'],
          replacement: (c) => `^${c}^`
        })

        td.addRule('underline', {
          filter: ['u'],
          replacement: (c) => `_${c}_`
        })

        td.addRule('taskList', {
          filter: (n, o) => {
            return (
              n.nodeName === 'INPUT' && n.getAttribute('type') === 'checkbox'
            )
          },
          replacement: (c, n) => {
            return n.getAttribute('checked') ? '[x] ' : '[ ] '
          }
        })

        td.addRule('removeTocAnchors', {
          filter: (n, o) => {
            return n.nodeName === 'A' && n.classList.contains('toc-anchor')
          },
          replacement: (c) => ''
        })

        td.addRule('diagram', {
          filter: (n, o) => {
            return n.nodeName === 'IMG' && n.getAttribute('src').startsWith('data:image/svg+xml;base64')
          },
          replacement: (c, n) => {
            let src = n.getAttribute('src')
            let start = 'data:image/svg+xml;base64,'.length
            let markdownDiagram = src.substring(start)
            if (!markdownDiagram.endsWith('\n')) {
              markdownDiagram = markdownDiagram + '\n'
            }
            return `\`\`\`diagram\n${markdownDiagram}\`\`\`\n`
          }
        })

        convertedContent = td.turndown(ogPage.content) + `\n` // adding extra line break for pages that end with a diagram

        // -> Unsupported
      } else {
        throw new Error(
          'Unsupported source / destination content types combination.'
        )
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
    await WIKI.models.pages
      .query()
      .patch({
        contentType: targetContentType,
        editorKey: opts.editor,
        ...(convertedContent ? { content: convertedContent } : {})
      })
      .where('id', ogPage.id)
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
    if (
      opts.destinationPath.includes('.') ||
      opts.destinationPath.includes(' ') ||
      opts.destinationPath.includes('\\') ||
      opts.destinationPath.includes('//')
    ) {
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
    checkAccess(opts.user, ['manage:pages'], {
      locale: page.localeCode,
      path: page.path,
      siteId: page.siteId
    }, 'PageMoveForbidden')
    // -> Check for destination page access
    checkAccess(opts.user, ['write:pages'], {
      locale: opts.destinationLocale,
      path: opts.destinationPath,
      siteId: page.siteId
    }, 'PageMoveForbidden')

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

    const destinationHash = await WIKI.models.pages.generatePageHash(
      opts.siteId,
      opts.destinationPath,
      opts.destinationLocale,
      opts.isPrivate
    )

    // -> Move page
    const destinationTitle =
      page.title === _.last(page.path.split('/')) ?
        _.last(opts.destinationPath.split('/')) :
        page.title
    await WIKI.models.pages
      .query()
      .patch({
        path: opts.destinationPath,
        localeCode: opts.destinationLocale,
        title: destinationTitle,
        hash: destinationHash
      })
      .findById(page.id)
    await WIKI.models.pages.deletePageFromCache(page.hash)
    WIKI.events.outbound.emit('deletePageFromCache', page.hash)

    // -> Update page tree (preserves custom child_position order)
    await WIKI.models.pages.rebuildTree(page, 'move', {
      path: opts.destinationPath,
      locale: opts.destinationLocale,
      title: destinationTitle
    })

    // -> Rename in Search Index
    const pageContents = await WIKI.models.pages
      .query()
      .findById(page.id)
      .select('render')
    page.safeContent = WIKI.models.pages.cleanHTML(pageContents.render)
    await WIKI.data.searchEngine.renamed({
      ...page,
      destinationPath: opts.destinationPath,
      destinationLocaleCode: opts.destinationLocale,
      title: destinationTitle,
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
      siteId: page.siteId,
      sourceLocale: page.localeCode,
      sourcePath: page.path,
      locale: opts.destinationLocale,
      path: opts.destinationPath,
      mode: 'move'
    })

    // -> Reconnect Links : Validate invalid links to the new path
    await WIKI.models.pages.reconnectLinks({
      siteId: page.siteId,
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
  static async deletePage(opts, skipSnapshot) {
    WIKI.logger.debug(`Deleting page with opts pageId = ${opts.id}`)
    const page = await WIKI.models.pages.getPageFromDb(
      _.has(opts, 'id') ? opts.id : opts
    )
    if (!page) {
      throw new WIKI.Error.PageNotFound()
    }

    // -> Check for page access
    if (
      !WIKI.auth.checkAccess(opts.user, ['delete:pages'], {
        locale: page.locale,
        path: page.path,
        siteId: page.siteId
      })
    ) {
      throw new WIKI.Error.PageDeleteForbidden()
    }

    // -> Create version snapshot
    if (!skipSnapshot) {
      await WIKI.models.pageHistory.addVersion({
        ...page,
        action: 'deleted',
        versionDate: page.updatedAt
      })
    }

    // -> Delete page
    await WIKI.models.pages.query().delete().where('id', page.id)
    await WIKI.models.pages.deletePageFromCache(page.hash)
    WIKI.events.outbound.emit('deletePageFromCache', page.hash)

    // -> Update page tree (preserves custom child_position order)
    await WIKI.models.pages.rebuildTree(page, 'delete')

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
      siteId: page.siteId,
      locale: page.localeCode,
      path: page.path,
      mode: 'delete'
    })
  }

  /**
   * Reconnect links to new/move/deleted page
   *
   * @param {Object} opts - Page parameters
   * @param {uuid} opts.siteId - Page siteId
   * @param {string} opts.path - Page Path
   * @param {string} opts.locale - Page Locale Code
   * @param {string} [opts.sourcePath] - Previous Page Path (move only)
   * @param {string} [opts.sourceLocale] - Previous Page Locale Code (move only)
   * @param {string} opts.mode - Page Update mode (create, move, delete)
   * @returns {Promise} Promise with no value
   */
  static async reconnectLinks(opts) {
    const site = await WIKI.models.sites.query().findById(opts.siteId)
    const host = WIKI.config.host
    const sitePath = site.path
    const pageHref = `/${sitePath}/${opts.path}`
    const pageLocaleHref = `/${sitePath}/${opts.sourceLocale}/${opts.path}`
    let replaceArgs = {
      InternalFrom: '',
      InternalTo: '',
      InternalLocaleFrom: '',
      InternalLocaleTo: '',
      ExternalFrom: '',
      ExternalTo: '',
      ExternalLocaleFrom: '',
      ExternalLocaleTo: '',
      MarkdownContentFrom: '',
      MarkdownContentTo: '',
      ExternalLocaleMarkdownContentFrom: '',
      ExternalLocaleMarkdownContentTo: '',
      ExternalMarkdownContentFrom: '',
      ExternalMarkdownContentTo: '',
      HtmlContentFrom: '',
      HtmlContentTo: '',
      ExternalHtmlContentFrom: '',
      ExternalHtmlContentTo: '',
      ExternalLocaleHtmlContentFrom: '',
      ExternalLocaleHtmlContentTo: ''
    }
    switch (opts.mode) {
      case 'create':
        replaceArgs.InternalFrom = `<a href="${pageHref}" class="is-internal-link is-invalid-page">`
        replaceArgs.InternalTo = `<a href="${pageHref}" class="is-internal-link is-valid-page">`
        break
      case 'move':
        const prevPageHref = `/${sitePath}/${opts.sourcePath}`
        const prevLocalePageHref = `/${sitePath}/${opts.sourceLocale}/${opts.sourcePath}`
        replaceArgs.InternalFrom = `<a class="is-internal-link is-invalid-page" href="${prevPageHref}">${opts.sourcePath}`
        replaceArgs.InternalTo = `<a class="is-internal-link is-invalid-page" href="${pageHref}">${opts.path}`
        replaceArgs.InternalLocaleFrom = `<a class="is-internal-link is-invalid-page" href="${pageLocaleHref}">${opts.sourcePath}`
        replaceArgs.InternalLocaleTo = `<a class="is-internal-link is-invalid-page" href="${prevLocalePageHref}">${opts.path}`
        replaceArgs.ExternalLocaleFrom = `<a class="is-internal-link is-invalid-page" href="${prevLocalePageHref}">${host}${prevLocalePageHref}`
        replaceArgs.ExternalLocaleTo = `<a class="is-internal-link is-invalid-page" href="${pageLocaleHref}">${host}${pageLocaleHref}`
        replaceArgs.ExternalFrom = `<a class="is-internal-link is-invalid-page" href="${prevPageHref}">${host}${prevPageHref}`
        replaceArgs.ExternalTo = `<a class="is-internal-link is-invalid-page" href="${pageHref}">${host}${pageHref}`
        replaceArgs.MarkdownContentFrom = `[${opts.sourcePath}](${prevPageHref})`
        replaceArgs.MarkdownContentTo = `[${opts.path}](${pageHref})`
        replaceArgs.ExternalMarkdownContentFrom = `${host}${prevPageHref}`
        replaceArgs.ExternalMarkdownContentTo = `${host}${pageHref}`
        replaceArgs.ExternalLocaleMarkdownContentFrom = `${host}${prevLocalePageHref}`
        replaceArgs.ExternalLocaleMarkdownContentTo = `${host}${pageLocaleHref}`
        replaceArgs.HtmlContentFrom = `<a href="${prevPageHref}">${prevPageHref}`
        replaceArgs.HtmlContentTo = `<a href="${pageHref}">${pageHref}`
        replaceArgs.ExternalHtmlContentFrom = `<a href="${host}${prevPageHref}">${host}${prevPageHref}`
        replaceArgs.ExternalHtmlContentTo = `<a href="${host}${pageHref}">${host}${pageHref}`
        replaceArgs.ExternalLocaleHtmlContentFrom = `<a href="${host}${prevLocalePageHref}">${host}${prevLocalePageHref}`
        replaceArgs.ExternalLocaleHtmlContentTo = `<a href="${host}${pageLocaleHref}">${host}${pageLocaleHref}`
        break
      case 'delete':
        replaceArgs.InternalFrom = `<a href="${pageHref}" class="is-internal-link is-valid-page">`
        replaceArgs.InternalTo = `<a href="${pageHref}" class="is-internal-link is-invalid-page">`
        break
      default:
        return false
    }

    let affectedHashes = []
    const targetPath = opts.mode === 'move' ? `${sitePath}/${opts.sourcePath}` : `${sitePath}/${opts.path}`
    const targetExternalPath = opts.mode === 'move' ? `${sitePath}/${opts.locale}/${opts.sourcePath}` : `${sitePath}/${opts.locale}/${opts.path}`

    // -> Perform replace and return affected page hashes (POSTGRES only)
    if (WIKI.config.db.type === 'postgres') {
      const qryHashes = await WIKI.models.pages
        .query()
        .returning('hash')
        .patch({
          render: WIKI.models.knex.raw(`
            REPLACE(
                REPLACE(
                  REPLACE(
                    REPLACE(??, ?, ?),
                    ?, ?
                  ),
                  ?, ?
                ),
                ?, ?
              )
            `, [
            'render',
            replaceArgs.InternalFrom,
            replaceArgs.InternalTo,
            replaceArgs.ExternalLocaleFrom,
            replaceArgs.ExternalLocaleTo,
            replaceArgs.ExternalFrom,
            replaceArgs.ExternalTo,
            replaceArgs.InternalLocaleFrom,
            replaceArgs.InternalLocaleTo
          ]),
          content: WIKI.models.knex.raw(`
            CASE
              WHEN "contentType" = 'markdown' THEN
                   REPLACE(
                    REPLACE(
                      REPLACE(??, ?, ?),
                      ?, ?
                    ),
                  ?, ?
      )
              WHEN "contentType" = 'html' THEN
                REPLACE(
                  REPLACE(
                    REPLACE(
                      ??,
                      ?, ?
                    ),
                    ?, ?
                  ),
                  ?, ?
                )
              ELSE ??
            END
          `, [
            'content',
            replaceArgs.MarkdownContentFrom,
            replaceArgs.MarkdownContentTo,
            replaceArgs.ExternalMarkdownContentFrom,
            replaceArgs.ExternalMarkdownContentTo,
            replaceArgs.ExternalLocaleMarkdownContentFrom,
            replaceArgs.ExternalLocaleMarkdownContentTo,
            'content',
            replaceArgs.HtmlContentFrom,
            replaceArgs.HtmlContentTo,
            replaceArgs.ExternalLocaleHtmlContentFrom,
            replaceArgs.ExternalLocaleHtmlContentTo,
            replaceArgs.ExternalHtmlContentFrom,
            replaceArgs.ExternalHtmlContentTo,
            'content'
          ])
        })
        .whereIn('pages.id', function () {
          this.select('pageLinks.pageId').from('pageLinks')
            .where(function() {
              this.where('pageLinks.path', targetExternalPath)
                .orWhere('pageLinks.path', targetPath)
            })
            .andWhere('pageLinks.localeCode', opts.locale)
        })
      const pageIds = await WIKI.models.knex
        .select('pageLinks.pageId')
        .from('pageLinks')
        .where('pageLinks.localeCode', opts.locale)
        .where(function() {
          this.where('pageLinks.path', targetExternalPath)
            .orWhere('pageLinks.path', targetPath)
        })
      const pages = await WIKI.models.pages
        .query()
        .whereIn('id', pageIds.map(p => p.pageId))
      await Promise.all(pages.map(page => WIKI.models.pages.renderPage(page)))
      affectedHashes = qryHashes.map((h) => h.hash)
    } else {
      // -> Perform replace, then query affected page hashes (MYSQL, MARIADB, MSSQL, SQLITE only)
      await WIKI.models.pages
        .query()
        .patch({
          render: WIKI.models.knex.raw('REPLACE(??, ?, ?)', [
            'render',
            replaceArgs.from,
            replaceArgs.to
          ])
        })
        .whereIn('pages.id', function () {
          this.select('pageLinks.pageId').from('pageLinks').where({
            'pageLinks.path': targetPath,
            'pageLinks.localeCode': opts.locale
          })
        })
      const qryHashes = await WIKI.models.pages
        .query()
        .column('hash')
        .whereIn('pages.id', function () {
          this.select('pageLinks.pageId').from('pageLinks').where({
            'pageLinks.path': opts.path,
            'pageLinks.localeCode': opts.locale
          })
        })
      affectedHashes = qryHashes.map((h) => h.hash)
    }
    await Promise.all(affectedHashes.map(async (hash) => {
      await WIKI.models.pages.deletePageFromCache(hash)
      WIKI.events.outbound.emit('deletePageFromCache', hash)
    }))
  }

  /**
   * Rebuild page tree using incremental updates to preserve child_position order
   *
   * @param {Object} page Page Model Instance
   * @param {String} action Action type: 'create', 'delete', 'move', or 'full' (default: 'create')
   * @param {Object} moveData For move action: { path, locale, title }
   * @returns {Promise} Promise with no value
   */
  static async rebuildTree(page, action = 'create', moveData = null) {
    if (action === 'full') {
      // Full rebuild for admin actions - uses the rebuild-tree job
      await WIKI.scheduler.registerJob(
        {
          name: 'rebuild-tree',
          immediate: true,
          wait: true
        },
        page?.siteId
      )
      return
    }

    // Incremental updates for create/delete/move
    switch (action) {
      case 'create':
        await WIKI.models.pages._addPageToTree(page)
        break

      case 'delete':
        await WIKI.models.pages._removePageFromTree(page)
        break

      case 'move': {
        // Remove old entries
        await WIKI.models.pages._removePageFromTree(page)
        // Add new entries with updated data
        const updatedPage = {
          ...page,
          path: moveData.path,
          localeCode: moveData.locale,
          title: moveData.title
        }
        await WIKI.models.pages._addPageToTree(updatedPage)
        break
      }
    }
  }

  /**
   * Internal: Add page to tree incrementally
   * @private
   */
  static async _addPageToTree(page) {
    const pagePaths = page.path.split('/')
    let currentPath = ''
    let depth = 0
    let parentId = null
    let ancestors = []

    for (const element of pagePaths) {
      const part = element
      depth++
      const isFolder = (depth < pagePaths.length)
      currentPath = currentPath ? `${currentPath}/${part}` : part

      // Check if node already exists
      const existing = await WIKI.models.knex('pageTree')
        .first('id', 'isFolder')
        .where({
          path: currentPath,
          localeCode: page.localeCode,
          siteId: page.siteId
        })

      if (existing) {
        // Node exists - just update if it should be a folder
        if (isFolder && !existing.isFolder) {
          await WIKI.models.knex('pageTree')
            .where('id', existing.id)
            .update({ isFolder: true })
        }
        parentId = existing.id
      } else {
        // Node doesn't exist - generate next ID and find max child_position for siblings
        const maxIdResult = await WIKI.models.knex('pageTree')
          .max('id as maxId')
          .first()

        const nextId = (maxIdResult?.maxId ?? 0) + 1

        const maxPositionQuery = WIKI.models.knex('pageTree')
          .max('child_position as maxPos')
          .where({
            siteId: page.siteId,
            localeCode: page.localeCode
          })

        if (parentId) {
          maxPositionQuery.where('parent', parentId)
        } else {
          maxPositionQuery.whereNull('parent')
        }

        const maxPositionResult = await maxPositionQuery.first()

        const nextPosition = (maxPositionResult?.maxPos ?? -1) + 1

        const nodeMeta = { nextId, depth, parentId, nextPosition, isFolder }

        // Insert new node with explicit ID
        await this.insertNewNodeWithExplictId(nodeMeta, page, currentPath, part, ancestors)

        parentId = nextId
      }

      ancestors.push(parentId)
    }
  }

  static async insertNewNodeWithExplictId(nodeMeta, page, currentPath, part, ancestors) {
    const isFolder = nodeMeta.isFolder
    await WIKI.models.knex('pageTree')
      .insert({
        id: nodeMeta.nextId,
        localeCode: page.localeCode,
        path: currentPath,
        depth: nodeMeta.depth,
        title: isFolder ? part : page.title,
        isFolder: isFolder,
        isPrivate: !isFolder && page.isPrivate,
        privateNS: !isFolder ? page.privateNS : null,
        parent: nodeMeta.parentId,
        pageId: isFolder ? null : page.id,
        ancestors: JSON.stringify(ancestors),
        siteId: page.siteId,
        child_position: nodeMeta.nextPosition
      })
  }

  /**
   * Internal: Remove page from tree incrementally
   * @private
   */
  static async _removePageFromTree(page) {
    // Delete the page tree entries for this page
    await WIKI.models.knex('pageTree')
      .where('pageId', page.id)
      .del()

    // Clean up empty folder nodes that have no children
    const pagePaths = page.path.split('/')
    for (let i = pagePaths.length - 1; i >= 0; i--) {
      const pathSegment = pagePaths.slice(0, i + 1).join('/')

      const folderNode = await WIKI.models.knex('pageTree')
        .first('id')
        .where({
          path: pathSegment,
          localeCode: page.localeCode,
          siteId: page.siteId,
          isFolder: true
        })

      if (folderNode) {
        // Check if this folder has any children
        const childCount = await WIKI.models.knex('pageTree')
          .count('* as count')
          .where('parent', folderNode.id)
          .first()

        if (parseInt(childCount.count) === 0) {
          // No children, delete this folder node
          await WIKI.models.knex('pageTree')
            .where('id', folderNode.id)
            .del()
        } else {
          // Has children, stop cleanup
          break
        }
      }
    }
  }

  /**
   * Trigger the rendering of a page
   *
   * @param {Object} page Page Model Instance
   * @returns {Promise} Promise with no value
   */
  static async renderPage(page) {
    await WIKI.scheduler.registerJob(
      {
        name: 'render-page',
        immediate: true,
        wait: true
      },
      page.id
    )
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
          // -> No render? Last page render failed...
          throw new Error(
            'Page has no rendered version. Looks like the Last page render failed. Try to edit the page and save it again.'
          )
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
      return WIKI.models.pages
        .query()
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
          'pages.siteId',
          {
            authorName: 'author.name',
            authorEmail: 'author.email',
            creatorName: 'creator.name',
            creatorEmail: 'creator.email'
          },
          {
            siteName: 'site.name',
            sitePath: 'site.path'
          }
        ])
        .joinRelated('site')
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
          'pages.localeCode': opts.locale,
          'siteId': opts.siteId
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
    const cachePath = path.resolve(
      WIKI.ROOTPATH,
      WIKI.config.dataPath,
      `cache/${page.hash}.bin`
    )
    await fs.outputFile(
      cachePath,
      WIKI.models.pages.cacheSchema.encode({
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
        contentType: page.contentType,
        render: page.render,
        tags: page.tags.map((t) => _.pick(t, ['tag', 'title'])),
        title: page.title,
        toc: _.isString(page.toc) ? page.toc : JSON.stringify(page.toc),
        updatedAt: page.updatedAt,
        siteId: page.siteId
      })
    )
  }

  /**
   * Generates page hash
   *
   * @param {Object} opts Page Properties
   * @returns {Promise} Promise of the Page Model Instance
   */
  static async generatePageHash(siteId, path, locale, isPrivate) {
    return pageHelper.generateHash({
      siteId,
      path,
      locale,
      privateNS: isPrivate ? 'TODO' : ''
    })
  }

  /**
   * Fetch an Existing Page from Cache
   *
   * @param {Object} opts Page Properties
   * @returns {Promise} Promise of the Page Model Instance
   */
  static async getPageFromCache(opts) {
    const pageHash = await WIKI.models.pages.generatePageHash(
      opts.siteId,
      opts.path,
      opts.locale,
      opts.isPrivate
    )
    const cachePath = path.resolve(
      WIKI.ROOTPATH,
      WIKI.config.dataPath,
      `cache/${pageHash}.bin`
    )

    try {
      const pageBuffer = await fs.readFile(cachePath)
      let page = WIKI.models.pages.cacheSchema.decode(pageBuffer)
      return {
        ...page,
        siteId: opts.siteId,
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
    return fs.remove(
      path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache/${hash}.bin`)
    )
  }

  /**
   * Flush the contents of the Cache
   */
  static async flushCache() {
    return fs.emptyDir(
      path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache`)
    )
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
    return WIKI.models.pages
      .query()
      .patch({
        localeCode: targetLocale
      })
      .where({
        localeCode: sourceLocale
      })
      .whereNotExists(function () {
        this.select('id')
          .from('pages AS pagesm')
          .where('pagesm.localeCode', targetLocale)
          .andWhereRaw('pagesm.path = pages.path')
      })
  }

  /**
   * Clean raw HTML from content for use in search engines
   *
   * @param {string} rawHTML Raw HTML
   * @returns {string} Cleaned Content Text
   */
  static cleanHTML(rawHTML = '') {
    let data = striptags(rawHTML || '', [], ' ').replace(emojiRegex(), '')
    // .replace(htmlEntitiesRegex, '')
    return he
      .decode(data)
      .replace(punctuationRegex, ' ')
      .replace(/(\r\n|\n|\r)/gm, ' ')
      .replace(/\s\s+/g, ' ')
      .split(' ')
      .filter((w) => w.length > 1)
      .join(' ')
      .toLowerCase()
  }

  /**
   * Subscribe to HA propagation events
   */
  static subscribeToEvents() {
    WIKI.events.inbound.on('deletePageFromCache', (hash) => {
      WIKI.models.pages.deletePageFromCache(hash)
    })
    WIKI.events.inbound.on('flushCache', () => {
      WIKI.models.pages.flushCache()
    })
  }
}
