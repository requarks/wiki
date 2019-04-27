const qs = require('querystring')
const _ = require('lodash')
const crypto = require('crypto')

const localeSegmentRegex = /^[A-Z]{2}(-[A-Z]{2})?$/gi
const systemSegmentRegex = /^[A-Z]\//gi

/* global WIKI */

module.exports = {
  /**
   * Parse raw url path and make it safe
   */
  parsePath (rawPath) {
    let pathObj = {
      locale: 'en',
      path: 'home',
      private: false,
      privateNS: ''
    }

    // Clean Path
    rawPath = _.trim(qs.unescape(rawPath))
    if (_.startsWith(rawPath, '/')) { rawPath = rawPath.substring(1) }
    if (rawPath === '') { rawPath = 'home' }

    // Extract Info
    let pathParts = _.filter(_.split(rawPath, '/'), p => !_.isEmpty(p))
    if (pathParts[0].length === 1) {
      pathParts.shift()
    }
    if (localeSegmentRegex.test(pathParts[0])) {
      pathObj.locale = pathParts[0]
      pathParts.shift()
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
      ['tags', '']
    ]
    switch (page.contentType) {
      case 'markdown':
        return '---\n' + meta.map(mt => `${mt[0]}: ${mt[1]}`).join('\n') + '\n---\n\n' + page.content
      case 'html':
        return '<!--\n' + meta.map(mt => `${mt[0]}: ${mt[1]}`).join('\n') + '\n-->\n\n' + page.content
      default:
        return page.content
    }
  },
  /**
   * Check if path is a reserved path
   */
  isReservedPath(rawPath) {
    const firstSection = _.head(rawPath.split('/'))
    return _.some(WIKI.data.reservedPaths, p => {
      return p === firstSection || systemSegmentRegex.test(rawPath)
    })
  }
}
