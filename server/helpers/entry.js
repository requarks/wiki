'use strict'

const crypto = require('crypto')
const path = require('path')
const qs = require('querystring')
const _ = require('lodash')

module.exports = {
  /**
   * Parse raw url path and make it safe
   *
   * @param      {String}  urlPath  The url path
   * @return     {String}  Safe entry path
   */
  parsePath (urlPath) {
    urlPath = qs.unescape(urlPath)
    let wlist = new RegExp('[^a-z0-9' + appdata.regex.cjk + appdata.regex.arabic + '/-]', 'g')

    urlPath = _.toLower(urlPath).replace(wlist, '')

    if (urlPath === '/') {
      urlPath = 'home'
    }

    let urlParts = _.filter(_.split(urlPath, '/'), (p) => { return !_.isEmpty(p) })

    return _.join(urlParts, '/')
  },

  /**
   * Gets the full original path of a document.
   *
   * @param      {String}  entryPath  The entry path
   * @return     {String}  The full path.
   */
  getFullPath (entryPath) {
    return path.join(appdata.repoPath, entryPath + '.md')
  },

  /**
   * Gets the full cache path of a document.
   *
   * @param      {String}    entryPath  The entry path
   * @return     {String}  The full cache path.
   */
  getCachePath (entryPath) {
    return path.join(appdata.cachePath, crypto.createHash('md5').update(entryPath).digest('hex') + '.json')
  },

  /**
   * Gets the entry path from full path.
   *
   * @param      {String}  fullPath  The full path
   * @return     {String}  The entry path
   */
  getEntryPathFromFullPath (fullPath) {
    let absRepoPath = path.resolve(ROOTPATH, appdata.repoPath)
    return _.chain(fullPath).replace(absRepoPath, '').replace('.md', '').replace(new RegExp('\\\\', 'g'), '/').value()
  }
}
