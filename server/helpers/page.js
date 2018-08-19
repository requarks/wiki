const qs = require('querystring')
const _ = require('lodash')

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
    if (pathParts[0].length === 2) {
      pathObj = pathParts[0]
      pathParts.shift()
    }
    pathObj.path = _.join(pathParts, '/')
    return pathObj
  }
}
