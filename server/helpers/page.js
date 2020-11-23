const qs = require('querystring')
const _ = require('lodash')
const crypto = require('crypto')
const path = require('path')

const localeSegmentRegex = /^[A-Z]{2}(-[A-Z]{2})?$/i
const localeFolderRegex = /^([a-z]{2}(?:-[a-z]{2})?\/)?(.*)/i
// eslint-disable-next-line no-control-regex
const unsafeCharsRegex = /[\x00-\x1f\x80-\x9f\\"|<>:*?]/

const contentToExt = {
  markdown: 'md',
  html: 'html'
}
const extToContent = _.invert(contentToExt)

/* global WIKI */

module.exports = {
  /**
   * Parse raw url path and make it safe
   */
  parsePath (rawPath, opts = {}) {
    let pathObj = {
      locale: WIKI.config.lang.code,
      path: 'home',
      private: false,
      privateNS: '',
      explicitLocale: false
    }

    // Clean Path
    rawPath = _.trim(qs.unescape(rawPath))
    if (_.startsWith(rawPath, '/')) { rawPath = rawPath.substring(1) }
    rawPath = rawPath.replace(unsafeCharsRegex, '')
    if (rawPath === '') { rawPath = 'home' }

    // Extract Info
    let pathParts = _.filter(_.split(rawPath, '/'), p => {
      p = _.trim(p)
      return !_.isEmpty(p) && p !== '..' && p !== '.'
    })
    if (pathParts[0].length === 1) {
      pathParts.shift()
    }
    if (localeSegmentRegex.test(pathParts[0])) {
      pathObj.locale = pathParts[0]
      pathObj.explicitLocale = true
      pathParts.shift()
    }

    // Strip extension
    if (opts.stripExt && pathParts.length > 0) {
      const lastPart = _.last(pathParts)
      if (lastPart.indexOf('.') > 0) {
        pathParts.pop()
        const lastPartMeta = path.parse(lastPart)
        pathParts.push(lastPartMeta.name)
      }
    }

    pathObj.path = _.join(pathParts, '/')
    return pathObj
  },
  /**
   * Generate unique hash from page
   */
  generateHash(opts) {
    return crypto.createHash('sha1').update(`${opts.locale}|${opts.path}|${opts.privateNS}`).digest('hex')
  },
  /**
   * Inject Page Metadata
   */
  injectPageMetadata(page) {
    let meta = [
      ['title', page.title],
      ['description', page.description],
      ['published', page.isPublished.toString()],
      ['date', page.updatedAt],
      ['tags', page.tags ? page.tags.map(t => t.tag).join(', ') : ''],
      ['editor', page.editorKey],
      ['dateCreated', page.createdAt]
    ]
    switch (page.contentType) {
      case 'markdown':
        return '---\n' + meta.map(mt => `${mt[0]}: ${mt[1]}`).join('\n') + '\n---\n\n' + page.content
      case 'html':
        return '<!--\n' + meta.map(mt => `${mt[0]}: ${mt[1]}`).join('\n') + '\n-->\n\n' + page.content
      case 'json':
        return {
          ...page.content,
          _meta: _.fromPairs(meta)
        }
      default:
        return page.content
    }
  },
  /**
   * Check if path is a reserved path
   */
  isReservedPath(rawPath) {
    const firstSection = _.head(rawPath.split('/'))
    if (firstSection.length <= 1) {
      return true
    } else if (localeSegmentRegex.test(firstSection)) {
      return true
    } else if (
      _.some(WIKI.data.reservedPaths, p => {
        return p === firstSection
      })) {
      return true
    } else {
      return false
    }
  },
  /**
   * Get file extension from content type
   */
  getFileExtension(contentType) {
    return _.get(contentToExt, contentType, 'txt')
  },
  /**
   * Get content type from file extension
   */
  getContentType (filePath) {
    const ext = _.last(filePath.split('.'))
    return _.get(extToContent, ext, false)
  },
  /**
   * Get Page Meta object from disk path
   */
  getPagePath (filePath) {
    let fpath = filePath
    if (process.platform === 'win32') {
      fpath = filePath.replace(/\\/g, '/')
    }
    let meta = {
      locale: WIKI.config.lang.code,
      path: _.initial(fpath.split('.')).join('')
    }
    const result = localeFolderRegex.exec(meta.path)
    if (result[1]) {
      meta = {
        locale: result[1].replace('/', ''),
        path: result[2]
      }
    }
    return meta
  }
}
