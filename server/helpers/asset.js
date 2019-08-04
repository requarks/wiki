const crypto = require('crypto')

module.exports = {
  /**
   * Generate unique hash from page
   */
  generateHash(assetPath) {
    return crypto.createHash('sha1').update(assetPath).digest('hex')
  }
}
