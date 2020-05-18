const cmdExists = require('command-exists')

module.exports = {
  key: 'git',
  title: 'Git',
  description: 'Distributed version control system. Required for the Git storage module.',
  isInstalled: false,
  async isCompatible () {
    return true
  },
  async check () {
    try {
      await cmdExists('git')
      this.isInstalled = true
    } catch (err) {
      this.isInstalled = false
    }
    return this.isInstalled
  }
}
