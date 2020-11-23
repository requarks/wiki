const fs = require('fs-extra')
const os = require('os')
const path = require('path')

/* global WIKI */

module.exports = {
  key: 'sharp',
  title: 'Sharp',
  description: 'Process and transform images. Required to generate thumbnails of uploaded images and perform transformations.',
  async isCompatible () {
    return os.arch() === 'x64'
  },
  isInstalled: false,
  async check () {
    this.isInstalled = await fs.pathExists(path.join(WIKI.ROOTPATH, 'node_modules/sharp'))
    return this.isInstalled
  }
}
