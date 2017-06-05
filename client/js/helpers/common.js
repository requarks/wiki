'use strict'

import filesize from 'filesize.js'
import toUpper from 'lodash/toUpper'

module.exports = {
  /**
   * Convert bytes to humanized form
   * @param {number} rawSize Size in bytes
   * @returns {string} Humanized file size
   */
  filesize(rawSize) {
    return toUpper(filesize(rawSize))
  }
}
