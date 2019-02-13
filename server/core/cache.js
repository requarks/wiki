const NodeCache = require('node-cache')

module.exports = {
  init() {
    return new NodeCache()
  }
}
