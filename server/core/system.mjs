import fse from 'fs-extra'
import path from 'node:path'

export default {
  updates: {
    channel: 'BETA',
    version: WIKI.version,
    releaseDate: WIKI.releaseDate,
    minimumVersionRequired: '3.0.0-beta.0',
    minimumNodeRequired: '18.0.0'
  },
  init () {
    fse.ensureDir(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'assets'))
    fse.ensureDir(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'uploads'))

    // Clear content cache
    fse.emptyDir(path.resolve(WIKI.ROOTPATH, WIKI.config.dataPath, 'cache'))

    return this
  }
}
