import filesize from 'filesize.js'
import _ from 'lodash'

/* global siteConfig */

const helpers = {
  /**
   * Convert bytes to humanized form
   * @param {number} rawSize Size in bytes
   * @returns {string} Humanized file size
   */
  filesize (rawSize) {
    return _.toUpper(filesize(rawSize))
  },
  /**
   * Convert raw path to safe path
   * @param {string} rawPath Raw path
   * @returns {string} Safe path
   */
  makeSafePath (rawPath) {
    let rawParts = _.split(_.trim(rawPath), '/')
    rawParts = _.map(rawParts, (r) => {
      return _.kebabCase(_.deburr(_.trim(r)))
    })

    return _.join(_.filter(rawParts, (r) => { return !_.isEmpty(r) }), '/')
  },
  resolvePath (path) {
    if (_.startsWith(path, '/')) { path = path.substring(1) }
    return `${siteConfig.path}${path}`
  },
  /**
   * Set Input Selection
   * @param {DOMElement} input The input element
   * @param {number} startPos The starting position
   * @param {nunber} endPos The ending position
   */
  setInputSelection (input, startPos, endPos) {
    input.focus()
    if (typeof input.selectionStart !== 'undefined') {
      input.selectionStart = startPos
      input.selectionEnd = endPos
    } else if (document.selection && document.selection.createRange) {
      // IE branch
      input.select()
      var range = document.selection.createRange()
      range.collapse(true)
      range.moveEnd('character', endPos)
      range.moveStart('character', startPos)
      range.select()
    }
  }
}

export default {
  install(Vue) {
    Vue.$helpers = helpers
    Object.defineProperties(Vue.prototype, {
      $helpers: {
        get() {
          return helpers
        }
      }
    })
  }
}
