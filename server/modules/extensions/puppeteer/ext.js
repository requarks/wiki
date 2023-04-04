const os = require('os')
const path = require('path')
const util = require('util')
const exec = util.promisify(require('child_process').exec)
const fs = require('fs-extra')

module.exports = {
  key: 'puppeteer',
  title: 'Puppeteer',
  description: 'Headless chromium browser for server-side rendering. Required for generating PDF versions of pages and render content elements on the server (e.g. Mermaid diagrams)',
  async isCompatible () {
    return os.arch() === 'x64'
  },
  isInstalled: false,
  isInstallable: true,
  async check () {
    try {
      this.isInstalled = await fs.pathExists(path.join(WIKI.SERVERPATH, 'node_modules/puppeteer-core/.local-chromium'))
    } catch (err) {
      this.isInstalled = false
    }
    return this.isInstalled
  },
  async install () {
    try {
      const { stdout, stderr } = await exec('node install.js', {
        cwd: path.join(WIKI.SERVERPATH, 'node_modules/puppeteer-core'),
        timeout: 300000,
        windowsHide: true
      })
      this.isInstalled = true
      WIKI.logger.info(stdout)
      WIKI.logger.warn(stderr)
    } catch (err) {
      WIKI.logger.error(err)
    }
  }
}
