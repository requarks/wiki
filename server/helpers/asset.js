const { is } = require('bluebird');
const crypto = require('crypto')
const path = require('path')

const SUPPORTED_INLINE_ASSETS_EXTENSIONS = ['.png', '.apng', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'];

module.exports = {
  /**
   * Generate unique hash from page
   */
  generateHash(assetPath) {
    return crypto.createHash('sha1').update(assetPath).digest('hex')
  },

  getPathInfo(assetPath) {
    return path.parse(assetPath.toLowerCase())
  },

  isSafeExtension(extension) {
    return SUPPORTED_INLINE_ASSETS_EXTENSIONS.includes(extension)
  }
}
