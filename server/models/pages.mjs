import { Model } from 'objection'
import { find, get, has, initial, isEmpty, isString, last, pick } from 'lodash-es'
import { Type as JSBinType } from 'js-binary'
import { getDictNameFromLocale } from '../helpers/common.mjs'
import { generateHash, getFileExtension, injectPageMetadata } from '../helpers/page.mjs'
import path from 'node:path'
import fse from 'fs-extra'
import yaml from 'js-yaml'
import striptags from 'striptags'
import emojiRegex from 'emoji-regex'
import he from 'he'
import CleanCSS from 'clean-css'
import TurndownService from 'turndown'
import { gfm as turndownPluginGfm } from '@joplin/turndown-plugin-gfm'
import cheerio from 'cheerio'

import { Locale } from './locales.mjs'
import { PageLink } from './pageLinks.mjs'
import { Tag } from './tags.mjs'
import { User } from './users.mjs'

const pageRegex = /^[a-zA-Z0-9-_/]*$/
const aliasRegex = /^[a-zA-Z0-9-_]*$/

const frontmatterRegex = {
  html: /^(<!-{2}(?:\n|\r)([\w\W]+?)(?:\n|\r)-{2}>)?(?:\n|\r)*([\w\W]*)*/,
  legacy: /^(<!-- TITLE: ?([\w\W]+?) ?-{2}>)?(?:\n|\r)?(<!-- SUBTITLE: ?([\w\W]+?) ?-{2}>)?(?:\n|\r)*([\w\W]*)*/i,
  markdown: /^(-{3}(?:\n|\r)([\w\W]+?)(?:\n|\r)-{3})?(?:\n|\r)*([\w\W]*)*/
}

/**
 * Pages model
 */
export class Page extends Model {
  static get tableName() { return 'pages' }

  static get jsonSchema () {
    return {
      type: 'object',
      required: ['path', 'title'],

      properties: {
        id: {type: 'string'},
        path: {type: 'string'},
        hash: {type: 'string'},
        title: {type: 'string'},
        description: {type: 'string'},
        publishState: {type: 'string'},
        publishStartDate: {type: 'string'},
        publishEndDate: {type: 'string'},
        content: {type: 'string'},
        contentType: {type: 'string'},
        render: {type: 'string'},
        siteId: {type: 'string'},
        createdAt: {type: 'string'},
        updatedAt: {type: 'string'}
      }
    }
  }

  static get jsonAttributes() {
    return ['config', 'historyData', 'relations', 'scripts', 'toc']
  }

  static get relationMappings() {
    return {
      // tags: {
      //   relation: Model.ManyToManyRelation,
      //   modelClass: Tag,
      //   join: {
      //     from: 'pages.id',
      //     through: {
      //       from: 'pageTags.pageId',
      //       to: 'pageTags.tagId'
      //     },
      //     to: 'tags.id'
      //   }
      // },
      links: {
        relation: Model.HasManyRelation,
        modelClass: PageLink,
        join: {
          from: 'pages.id',
          to: 'pageLinks.pageId'
        }
      },
      author: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'pages.authorId',
          to: 'users.id'
        }
      },
      creator: {
        relation: Model.BelongsToOneRelation,
        modelClass: User,
        join: {
          from: 'pages.creatorId',
          to: 'users.id'
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
    await WIKI.db.comments.query().delete().where('pageId', page[0].id)
  }
  /**
   * Cache Schema
   */
  static get cacheSchema() {
    return new JSBinType({
      id: 'string',
      authorId: 'string',
      authorName: 'string',
      createdAt: 'string',
      creatorId: 'string',
      creatorName: 'string',
      description: 'string',
      editor: 'string',
      publishState: 'string',
      publishEndDate: 'string',
      publishStartDate: 'string',
      render: 'string',
      siteId: 'string',
      tags: [
        {
          tag: 'string'
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
    return injectPageMetadata(this)
  }

  /**
   * Get the page's file extension based on content type
   *
   * @returns {string} File Extension
   */
  getFileExtension() {
    return getFileExtension(this.contentType)
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
    // -> Validate site
    if (!WIKI.sites[opts.siteId]) {
      throw new Error('ERR_INVALID_SITE_ID')
    }

    // -> Remove trailing slash
    if (opts.path.endsWith('/')) {
      opts.path = opts.path.slice(0, -1)
    }

    // -> Remove starting slash
    if (opts.path.startsWith('/')) {
      opts.path = opts.path.slice(1)
    }

    // -> Validate path
    if (!pageRegex.test(opts.path)) {
      throw new Error('ERR_INVALID_PATH')
    }

    opts.path = opts.path.toLowerCase()
    // const dotPath = opts.path.replaceAll('/', '.').replaceAll('-', '_')

    // -> Check for page access
    if (!WIKI.auth.checkAccess(opts.user, ['write:pages'], {
      locale: opts.locale,
      path: opts.path
    })) {
      throw new Error('ERR_FORBIDDEN')
    }

    // -> Check for duplicate
    const dupCheck = await WIKI.db.pages.query().findOne({
      siteId: opts.siteId,
      locale: opts.locale,
      path: opts.path
    }).select('id')
    if (dupCheck) {
      throw new Error('ERR_PAGE_DUPLICATE_PATH')
    }

    // -> Check for alias
    if (opts.alias) {
      if (!aliasRegex.test(opts.alias)) {
        throw new Error('ERR_PAGE_INVALID_ALIAS')
      }
      const dupAliasCheck = await WIKI.db.pages.query().findOne({
        siteId: opts.siteId,
        alias: opts.alias
      }).select('id')
      if (dupAliasCheck) {
        throw new Error('ERR_PAGE_DUPLICATE_ALIAS')
      }
    }

    // -> Check for empty content
    if (!opts.content || opts.content.trim().length < 1) {
      throw new WIKI.Error.PageEmptyContent()
    }

    // -> Format CSS Scripts
    let scriptCss = ''
    if (WIKI.auth.checkAccess(opts.user, ['write:styles'], {
      locale: opts.locale,
      path: opts.path
    })) {
      if (!isEmpty(opts.scriptCss)) {
        scriptCss = new CleanCSS({ inline: false }).minify(opts.scriptCss).styles
      } else {
        scriptCss = ''
      }
    }

    // -> Format JS Scripts
    let scriptJsLoad = ''
    let scriptJsUnload = ''
    if (WIKI.auth.checkAccess(opts.user, ['write:scripts'], {
      locale: opts.locale,
      path: opts.path
    })) {
      scriptJsLoad = opts.scriptJsLoad || ''
      scriptJsUnload = opts.scriptJsUnload || ''
    }

    // -> Get Tags
    let tags = []
    if (opts.tags && opts.tags.length > 0) {
      tags = await WIKI.db.tags.processNewTags(opts.tags, opts.siteId)
    }

    // -> Create page
    const page = await WIKI.db.pages.query().insert({
      alias: opts.alias,
      authorId: opts.user.id,
      content: opts.content,
      creatorId: opts.user.id,
      config: {
        allowComments: opts.allowComments ?? true,
        allowContributions: opts.allowContributions ?? true,
        allowRatings: opts.allowRatings ?? true,
        showSidebar: opts.showSidebar ?? true,
        showTags: opts.showTags ?? true,
        showToc: opts.showToc ?? true,
        tocDepth: opts.tocDepth ?? WIKI.sites[opts.siteId].config?.defaults.tocDepth
      },
      contentType: WIKI.data.editors[opts.editor]?.contentType ?? 'text',
      description: opts.description,
      editor: opts.editor,
      hash: generateHash({ path: opts.path, locale: opts.locale }),
      icon: opts.icon,
      isBrowsable: opts.isBrowsable ?? true,
      isSearchable: opts.isSearchable ?? true,
      locale: opts.locale,
      ownerId: opts.user.id,
      path: opts.path,
      publishState: opts.publishState,
      publishEndDate: opts.publishEndDate?.toISO(),
      publishStartDate: opts.publishStartDate?.toISO(),
      relations: opts.relations ?? [],
      siteId: opts.siteId,
      tags,
      title: opts.title,
      toc: '[]',
      scripts: JSON.stringify({
        jsLoad: scriptJsLoad,
        jsUnload: scriptJsUnload,
        css: scriptCss
      })
    }).returning('*')

    // -> Render page to HTML
    await WIKI.db.pages.renderPage(page)

    // -> Add to tree
    const pathParts = page.path.split('/')
    await WIKI.db.tree.addPage({
      id: page.id,
      parentPath: initial(pathParts).join('/'),
      fileName: last(pathParts),
      locale: page.locale,
      title: page.title,
      meta: {
        authorId: page.authorId,
        contentType: page.contentType,
        creatorId: page.creatorId,
        description: page.description,
        isBrowsable: page.isBrowsable,
        ownerId: page.ownerId,
        publishState: page.publishState,
        publishEndDate: page.publishEndDate,
        publishStartDate: page.publishStartDate
      },
      siteId: page.siteId
    })

    // -> Update search vector
    WIKI.db.pages.updatePageSearchVector({ id: page.id })

    // // -> Add to Storage
    // if (!opts.skipStorage) {
    //   await WIKI.db.storage.pageEvent({
    //     event: 'created',
    //     page
    //   })
    // }

    // // -> Reconnect Links
    // await WIKI.db.pages.reconnectLinks({
    //   locale: page.locale,
    //   path: page.path,
    //   mode: 'create'
    // })

    // -> Get latest updatedAt
    page.updatedAt = await WIKI.db.pages.query().findById(page.id).select('updatedAt').then(r => r.updatedAt)

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
    const ogPage = await WIKI.db.pages.query().findById(opts.id)
    if (!ogPage) {
      throw new Error('ERR_PAGE_NOT_FOUND')
    }

    // -> Check for page access
    if (!WIKI.auth.checkAccess(opts.user, ['write:pages'], {
      locale: ogPage.locale,
      path: ogPage.path
    })) {
      throw new Error('ERR_PAGE_UPDATE_FORBIDDEN')
    }

    const patch = {}
    const historyData = {
      action: 'updated',
      affectedFields: []
    }
    let shouldUpdateSearch = false

    // -> Create version snapshot
    await WIKI.db.pageHistory.addVersion(ogPage)

    // -> Basic fields
    if ('title' in opts.patch) {
      patch.title = opts.patch.title.trim()
      historyData.affectedFields.push('title')
      shouldUpdateSearch = true

      if (patch.title.length < 1) {
        throw new Error('ERR_PAGE_TITLE_MISSING')
      }
    }

    if ('description' in opts.patch) {
      patch.description = opts.patch.description.trim()
      historyData.affectedFields.push('description')
      shouldUpdateSearch = true
    }

    if ('icon' in opts.patch) {
      patch.icon = opts.patch.icon.trim()
      historyData.affectedFields.push('icon')
    }

    if ('alias' in opts.patch) {
      patch.alias = opts.patch.alias.trim()
      historyData.affectedFields.push('alias')

      if (patch.alias.length > 255) {
        throw new Error('ERR_PAGE_ALIAS_TOO_LONG')
      } else if (!aliasRegex.test(patch.alias)) {
        throw new Error('ERR_PAGE_INVALID_ALIAS')
      } else if (patch.alias.length > 0) {
        const dupAliasCheck = await WIKI.db.pages.query().where({
          siteId: ogPage.siteId,
          alias: patch.alias
        }).andWhereNot('id', ogPage.id).select('id').first()
        if (dupAliasCheck) {
          throw new Error('ERR_PAGE_DUPLICATE_ALIAS')
        }
      }
    }

    if ('content' in opts.patch && opts.patch.content) {
      patch.content = opts.patch.content
      historyData.affectedFields.push('content')
      shouldUpdateSearch = true
    }

    // -> Publish State
    if (opts.patch.publishState) {
      patch.publishState = opts.patch.publishState
      historyData.affectedFields.push('publishState')

      if (patch.publishState === 'scheduled' && (!opts.patch.publishStartDate || !opts.patch.publishEndDate)) {
        throw new Error('ERR_PAGE_MISSING_SCHEDULED_DATES')
      }
    }
    if (opts.patch.publishStartDate) {
      patch.publishStartDate = opts.patch.publishStartDate
      historyData.affectedFields.push('publishStartDate')
    }
    if (opts.patch.publishEndDate) {
      patch.publishEndDate = opts.patch.publishEndDate
      historyData.affectedFields.push('publishEndDate')
    }

    // -> Browsable / Searchable Flags
    if ('isBrowsable' in opts.patch) {
      patch.isBrowsable = opts.patch.isBrowsable
      historyData.affectedFields.push('isBrowsable')
    }
    if ('isSearchable' in opts.patch) {
      patch.isSearchable = opts.patch.isSearchable
      historyData.affectedFields.push('isSearchable')
    }

    // -> Page Config
    if ('allowComments' in opts.patch) {
      patch.config = {
        ...patch.config ?? ogPage.config ?? {},
        allowComments: opts.patch.allowComments
      }
      historyData.affectedFields.push('allowComments')
    }
    if ('allowContributions' in opts.patch) {
      patch.config = {
        ...patch.config ?? ogPage.config ?? {},
        allowContributions: opts.patch.allowContributions
      }
      historyData.affectedFields.push('allowContributions')
    }
    if ('allowRatings' in opts.patch) {
      patch.config = {
        ...patch.config ?? ogPage.config ?? {},
        allowRatings: opts.patch.allowRatings
      }
      historyData.affectedFields.push('allowRatings')
    }
    if ('showSidebar' in opts.patch) {
      patch.config = {
        ...patch.config ?? ogPage.config ?? {},
        showSidebar: opts.patch.showSidebar
      }
      historyData.affectedFields.push('showSidebar')
    }
    if ('showTags' in opts.patch) {
      patch.config = {
        ...patch.config ?? ogPage.config ?? {},
        showTags: opts.patch.showTags
      }
      historyData.affectedFields.push('showTags')
    }
    if ('showToc' in opts.patch) {
      patch.config = {
        ...patch.config ?? ogPage.config ?? {},
        showToc: opts.patch.showToc
      }
      historyData.affectedFields.push('showToc')
    }
    if ('tocDepth' in opts.patch) {
      patch.config = {
        ...patch.config ?? ogPage.config ?? {},
        tocDepth: opts.patch.tocDepth
      }
      historyData.affectedFields.push('tocDepth')

      if (patch.config.tocDepth?.min < 1 || patch.config.tocDepth?.min > 6) {
        throw new Error('ERR_PAGE_INVALID_TOC_DEPTH')
      }
      if (patch.config.tocDepth?.max < 1 || patch.config.tocDepth?.max > 6) {
        throw new Error('ERR_PAGE_INVALID_TOC_DEPTH')
      }
    }

    // -> Relations
    if ('relations' in opts.patch) {
      patch.relations = opts.patch.relations.map(r => {
        if (r.label.length < 1) {
          throw new Error('ERR_PAGE_RELATION_LABEL_MISSING')
        } else if (r.label.length > 255) {
          throw new Error('ERR_PAGE_RELATION_LABEL_TOOLONG')
        } else if (r.icon.length > 255) {
          throw new Error('ERR_PAGE_RELATION_ICON_INVALID')
        } else if (r.target.length > 1024) {
          throw new Error('ERR_PAGE_RELATION_TARGET_INVALID')
        }
        return r
      })
      historyData.affectedFields.push('relations')
    }

    // -> Format CSS Scripts
    if (opts.patch.scriptCss) {
      if (WIKI.auth.checkAccess(opts.user, ['write:styles'], {
        locale: ogPage.locale,
        path: ogPage.path
      })) {
        patch.scripts = {
          ...patch.scripts ?? ogPage.scripts ?? {},
          css: !isEmpty(opts.patch.scriptCss) ? new CleanCSS({ inline: false }).minify(opts.patch.scriptCss).styles : ''
        }
        historyData.affectedFields.push('scripts.css')
      }
    }

    // -> Format JS Scripts
    if (opts.patch.scriptJsLoad) {
      if (WIKI.auth.checkAccess(opts.user, ['write:scripts'], {
        locale: ogPage.locale,
        path: ogPage.path
      })) {
        patch.scripts = {
          ...patch.scripts ?? ogPage.scripts ?? {},
          jsLoad: opts.patch.scriptJsLoad ?? ''
        }
        historyData.affectedFields.push('scripts.jsLoad')
      }
    }
    if (opts.patch.scriptJsUnload) {
      if (WIKI.auth.checkAccess(opts.user, ['write:scripts'], {
        locale: ogPage.locale,
        path: ogPage.path
      })) {
        patch.scripts = {
          ...patch.scripts ?? ogPage.scripts ?? {},
          jsUnload: opts.patch.scriptJsUnload ?? ''
        }
        historyData.affectedFields.push('scripts.jsUnload')
      }
    }

    // -> Tags
    if ('tags' in opts.patch) {
      patch.tags = await WIKI.db.tags.processNewTags(opts.patch.tags, ogPage.siteId)
      historyData.affectedFields.push('tags')
    }

    // -> Update page
    await WIKI.db.pages.query().patch({
      ...patch,
      authorId: opts.user.id,
      historyData
    }).where('id', ogPage.id)
    let page = await WIKI.db.pages.getPageFromDb(ogPage.id)

    // -> Render page to HTML
    if (opts.patch.content) {
      await WIKI.db.pages.renderPage(page)
    }
    WIKI.events.outbound.emit('deletePageFromCache', page.hash)

    // -> Update tree
    await WIKI.db.knex('tree').where('id', page.id).update({
      title: page.title,
      meta: {
        authorId: page.authorId,
        contentType: page.contentType,
        creatorId: page.creatorId,
        description: page.description,
        isBrowsable: page.isBrowsable,
        ownerId: page.ownerId,
        publishState: page.publishState,
        publishEndDate: page.publishEndDate,
        publishStartDate: page.publishStartDate
      },
      updatedAt: page.updatedAt
    })

    // -> Update search vector
    if (shouldUpdateSearch) {
      WIKI.db.pages.updatePageSearchVector({ id: page.id })
    }

    // -> Update on Storage
    // if (!opts.skipStorage) {
    //   await WIKI.db.storage.pageEvent({
    //     event: 'updated',
    //     page
    //   })
    // }

    // -> Get latest updatedAt
    page.updatedAt = await WIKI.db.pages.query().findById(page.id).select('updatedAt').then(r => r.updatedAt)

    return page
  }

  /**
   * Update a page text search vector value
   *
   * @param {Object} opts - Options
   * @param {string} [opts.id] - Page ID to update (fetch from DB)
   * @param {Object} [opts.page] - Page object to update (use directly)
   */
  static async updatePageSearchVector ({ id, page }) {
    if (!page) {
      if (!id) {
        throw new Error('Must provide either the page ID or the page object.')
      }
      page = await WIKI.db.pages.query().findById(id).select('id', 'locale', 'render', 'password')
    }
    // -> Exclude password-protected content from being indexed
    const safeContent = page.password ? '' : WIKI.db.pages.cleanHTML(page.render)
    const dictName = getDictNameFromLocale(page.locale)
    return WIKI.db.knex('pages').where('id', page.id).update({
      searchContent: safeContent,
      ts: WIKI.db.knex.raw(`
        setweight(to_tsvector('${dictName}', coalesce(title,'')), 'A') ||
        setweight(to_tsvector('${dictName}', coalesce(description,'')), 'B') ||
        setweight(to_tsvector('${dictName}', coalesce(?,'')), 'C')`, [safeContent])
    })
  }

  /**
   * Refresh Autocomplete Index
   */
  static async refreshAutocompleteIndex () {
    await WIKI.db.knex('autocomplete').truncate()
    await WIKI.db.knex.raw(`
      INSERT INTO "autocomplete" (word)
        SELECT word FROM ts_stat(
          'SELECT to_tsvector(''simple'', "title") || to_tsvector(''simple'', "description") || to_tsvector(''simple'', "searchContent") FROM "pages" WHERE "isSearchableComputed" IS TRUE'
        )
    `)
  }

  /**
   * Convert an Existing Page
   *
   * @param {Object} opts Page Properties
   * @returns {Promise} Promise of the Page Model Instance
   */
  static async convertPage(opts) {
    // -> Fetch original page
    const ogPage = await WIKI.db.pages.query().findById(opts.id)
    if (!ogPage) {
      throw new Error('Invalid Page Id')
    }

    if (ogPage.editor === opts.editor) {
      throw new Error('Page is already using this editor. Nothing to convert.')
    }

    // -> Check for page access
    if (!WIKI.auth.checkAccess(opts.user, ['write:pages'], {
      locale: ogPage.locale,
      path: ogPage.path
    })) {
      throw new WIKI.Error.PageUpdateForbidden()
    }

    // -> Check content type
    const sourceContentType = ogPage.contentType
    const targetContentType = get(find(WIKI.data.editors, ['key', opts.editor]), `contentType`, 'text')
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
      await WIKI.db.pageHistory.addVersion({
        ...ogPage,
        action: 'updated',
        versionDate: ogPage.updatedAt
      })
    }

    // -> Update page
    await WIKI.db.pages.query().patch({
      contentType: targetContentType,
      editor: opts.editor,
      ...(convertedContent ? { content: convertedContent } : {})
    }).where('id', ogPage.id)
    const page = await WIKI.db.pages.getPageFromDb(ogPage.id)

    await WIKI.db.pages.deletePageFromCache(page.hash)
    WIKI.events.outbound.emit('deletePageFromCache', page.hash)

    // -> Update on Storage
    await WIKI.db.storage.pageEvent({
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
    if (has(opts, 'id')) {
      page = await WIKI.db.pages.query().findById(opts.id)
    } else {
      page = await WIKI.db.pages.query().findOne({
        path: opts.path,
        locale: opts.locale
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
      locale: page.locale,
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
    const destPage = await WIKI.db.pages.query().findOne({
      path: opts.destinationPath,
      locale: opts.destinationLocale
    })
    if (destPage) {
      throw new WIKI.Error.PagePathCollision()
    }

    // -> Create version snapshot
    await WIKI.db.pageHistory.addVersion({
      ...page,
      action: 'moved',
      versionDate: page.updatedAt
    })

    const destinationHash = generateHash({ path: opts.destinationPath, locale: opts.destinationLocale })

    // -> Move page
    const destinationTitle = (page.title === page.path ? opts.destinationPath : page.title)
    await WIKI.db.pages.query().patch({
      path: opts.destinationPath,
      locale: opts.destinationLocale,
      title: destinationTitle,
      hash: destinationHash
    }).findById(page.id)
    await WIKI.db.pages.deletePageFromCache(page.hash)
    WIKI.events.outbound.emit('deletePageFromCache', page.hash)

    // -> Rebuild page tree
    await WIKI.db.pages.rebuildTree()

    // -> Rename in Search Index
    const pageContents = await WIKI.db.pages.query().findById(page.id).select('render')
    page.safeContent = WIKI.db.pages.cleanHTML(pageContents.render)
    await WIKI.data.searchEngine.renamed({
      ...page,
      destinationPath: opts.destinationPath,
      destinationLocale: opts.destinationLocale,
      destinationHash
    })

    // -> Rename in Storage
    if (!opts.skipStorage) {
      await WIKI.db.storage.pageEvent({
        event: 'renamed',
        page: {
          ...page,
          destinationPath: opts.destinationPath,
          destinationLocale: opts.destinationLocale,
          destinationHash,
          moveAuthorId: opts.user.id,
          moveAuthorName: opts.user.name,
          moveAuthorEmail: opts.user.email
        }
      })
    }

    // -> Reconnect Links : Changing old links to the new path
    await WIKI.db.pages.reconnectLinks({
      sourceLocale: page.locale,
      sourcePath: page.path,
      locale: opts.destinationLocale,
      path: opts.destinationPath,
      mode: 'move'
    })

    // -> Reconnect Links : Validate invalid links to the new path
    await WIKI.db.pages.reconnectLinks({
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
    const page = await WIKI.db.pages.getPageFromDb(has(opts, 'id') ? opts.id : opts)
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
    await WIKI.db.pageHistory.addVersion({
      ...page,
      action: 'deleted',
      versionDate: page.updatedAt
    })

    // -> Delete page
    await WIKI.db.pages.query().delete().where('id', page.id)
    await WIKI.db.knex('tree').where('id', page.id).del()
    await WIKI.db.pages.deletePageFromCache(page.hash)
    WIKI.events.outbound.emit('deletePageFromCache', page.hash)

    // -> Delete from Search Index
    await WIKI.data.searchEngine.deleted(page)

    // -> Delete from Storage
    if (!opts.skipStorage) {
      await WIKI.db.storage.pageEvent({
        event: 'deleted',
        page
      })
    }

    // -> Reconnect Links
    await WIKI.db.pages.reconnectLinks({
      locale: page.locale,
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
      const qryHashes = await WIKI.db.pages.query()
        .returning('hash')
        .patch({
          render: WIKI.db.knex.raw('REPLACE(??, ?, ?)', ['render', replaceArgs.from, replaceArgs.to])
        })
        .whereIn('pages.id', function () {
          this.select('pageLinks.pageId').from('pageLinks').where({
            'pageLinks.path': opts.path,
            'pageLinks.locale': opts.locale
          })
        })
      affectedHashes = qryHashes.map(h => h.hash)
    } else {
      // -> Perform replace, then query affected page hashes (MYSQL, MARIADB, MSSQL, SQLITE only)
      await WIKI.db.pages.query()
        .patch({
          render: WIKI.db.knex.raw('REPLACE(??, ?, ?)', ['render', replaceArgs.from, replaceArgs.to])
        })
        .whereIn('pages.id', function () {
          this.select('pageLinks.pageId').from('pageLinks').where({
            'pageLinks.path': opts.path,
            'pageLinks.locale': opts.locale
          })
        })
      const qryHashes = await WIKI.db.pages.query()
        .column('hash')
        .whereIn('pages.id', function () {
          this.select('pageLinks.pageId').from('pageLinks').where({
            'pageLinks.path': opts.path,
            'pageLinks.locale': opts.locale
          })
        })
      affectedHashes = qryHashes.map(h => h.hash)
    }
    for (const hash of affectedHashes) {
      await WIKI.db.pages.deletePageFromCache(hash)
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
    const renderJob = await WIKI.scheduler.addJob({
      task: 'render-page',
      payload: {
        id: page.id
      },
      maxRetries: 0,
      promise: true
    })
    return renderJob.promise
  }

  /**
   * Fetch an Existing Page from Cache if possible, from DB otherwise and save render to Cache
   *
   * @param {Object} opts Page Properties
   * @returns {Promise} Promise of the Page Model Instance
   */
  static async getPage(opts) {
    return WIKI.db.pages.getPageFromDb(opts)

    // -> Get from cache first
    let page = await WIKI.db.pages.getPageFromCache(opts)
    if (!page) {
      // -> Get from DB
      page = await WIKI.db.pages.getPageFromDb(opts)
      if (page) {
        if (page.render) {
          // -> Save render to cache
          await WIKI.db.pages.savePageToCache(page)
        } else {
          // -> No render? Possible duplicate issue
          /* TODO: Detect duplicate and delete */
          throw new Error('Error while fetching page. No rendered version of this page exists. Try to edit the page and save it again.')
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
    const queryModeID = typeof opts === 'string'
    try {
      return WIKI.db.pages.query()
        .column([
          'pages.*',
          {
            authorName: 'author.name',
            authorEmail: 'author.email',
            creatorName: 'creator.name',
            creatorEmail: 'creator.email'
          },
          'tree.navigationId'
        ])
        .joinRelated('author')
        .joinRelated('creator')
        .leftJoin('tree', 'pages.id', 'tree.id')
        .where(queryModeID ? {
          'pages.id': opts
        } : {
          'pages.siteId': opts.siteId,
          'pages.path': opts.path,
          'pages.locale': opts.locale
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
    await fse.outputFile(cachePath, WIKI.db.pages.cacheSchema.encode({
      id: page.id,
      authorId: page.authorId,
      authorName: page.authorName,
      createdAt: page.createdAt.toISOString(),
      creatorId: page.creatorId,
      creatorName: page.creatorName,
      description: page.description,
      editor: page.editor,
      extra: {
        css: get(page, 'extra.css', ''),
        js: get(page, 'extra.js', '')
      },
      publishState: page.publishState ?? '',
      publishEndDate: page.publishEndDate ?? '',
      publishStartDate: page.publishStartDate ?? '',
      render: page.render,
      siteId: page.siteId,
      tags: page.tags.map(t => pick(t, ['tag'])),
      title: page.title,
      toc: isString(page.toc) ? page.toc : JSON.stringify(page.toc),
      updatedAt: page.updatedAt.toISOString()
    }))
  }

  /**
   * Fetch an Existing Page from Cache
   *
   * @param {Object} opts Page Properties
   * @returns {Promise} Promise of the Page Model Instance
   */
  static async getPageFromCache(opts) {
    const pageHash = generateHash({ path: opts.path, locale: opts.locale })
    const cachePath = path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache/${pageHash}.bin`)

    try {
      const pageBuffer = await fse.readFile(cachePath)
      let page = WIKI.db.pages.cacheSchema.decode(pageBuffer)
      return {
        ...page,
        path: opts.path,
        locale: opts.locale
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
    return fse.remove(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache/${hash}.bin`))
  }

  /**
   * Flush the contents of the Cache
   */
  static async flushCache() {
    return fse.emptyDir(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, `cache`))
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
    return WIKI.db.pages.query()
      .patch({
        locale: targetLocale
      })
      .where({
        locale: sourceLocale
      })
      .whereNotExists(function() {
        this.select('id').from('pages AS pagesm').where('pagesm.locale', targetLocale).andWhereRaw('pagesm.path = pages.path')
      })
  }

  /**
   * Clean raw HTML from content for use in search engines
   *
   * @param {string} rawHTML Raw HTML
   * @returns {string} Cleaned Content Text
   */
  static cleanHTML(rawHTML = '') {
    const data = striptags(rawHTML || '', [], ' ')
      .replace(emojiRegex(), '')
    return he.decode(data)
      .replace(/(\r\n|\n|\r)/gm, ' ')
      .replace(/\s\s+/g, ' ')
  }

  /**
   * Subscribe to HA propagation events
   */
  static subscribeToEvents() {
    WIKI.events.inbound.on('deletePageFromCache', hash => {
      WIKI.db.pages.deletePageFromCache(hash)
    })
    WIKI.events.inbound.on('flushCache', () => {
      WIKI.db.pages.flushCache()
    })
  }
}
