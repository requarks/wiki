import cmdExists from 'command-exists'

export default {
  key: 'git',
  title: 'Git',
  description: 'Distributed version control system. Required for the Git storage module.',
  isInstalled: false,
  isInstallable: false,
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
