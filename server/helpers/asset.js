const crypto = require('crypto')
const path = require('path')

module.exports = {
  /**
   * Generate unique hash from page
   */
  generateHash(assetPath) {
    return crypto.createHash('sha1').update(assetPath).digest('hex')
  },

  getPathInfo(assetPath) {
    return path.parse(assetPath.toLowerCase())
  }
}
