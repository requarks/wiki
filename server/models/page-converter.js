const _ = require('lodash')
const TurndownService = require('turndown')
const turndownPluginGfm = require('@joplin/turndown-plugin-gfm').gfm
const cheerio = require('cheerio')

/* global WIKI */

module.exports = class PageConverter {
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
}