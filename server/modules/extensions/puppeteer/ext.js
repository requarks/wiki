const cmdExists = require('command-exists')
const os = require('os')

module.exports = {
  key: 'puppeteer',
  title: 'Puppeteer',
  description: 'Headless chromium browser for server-side rendering. Required for generating PDF versions of pages and render content elements on the server (e.g. Mermaid diagrams)',
  async isCompatible () {
    return os.arch() === 'x64'
  },
  isInstalled: false,
  async check () {
    try {
      await cmdExists('pandoc')
      this.isInstalled = true
    } catch (err) {
      this.isInstalled = false
    }
    return this.isInstalled
  }
}
