const cmdExists = require('command-exists')
const os = require('os')

module.exports = {
  key: 'pandoc',
  title: 'Pandoc',
  description: 'Convert between markup formats. Required for converting from other formats such as MediaWiki, AsciiDoc, Textile and other wikis.',
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
