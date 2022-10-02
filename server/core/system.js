const fs = require('fs-extra')
const path = require('path')

module.exports = {
  updates: {
    channel: 'BETA',
    version: WIKI.version,
    releaseDate: WIKI.releaseDate,
    minimumVersionRequired: '3.0.0-beta.0',
    minimumNodeRequired: '18.0.0'
  },
  init () {
    // Clear content cache
    fs.emptyDir(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'cache'))

    return this
  }
}
