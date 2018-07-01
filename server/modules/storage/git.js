module.exports = {
  key: 'git',
  title: 'Git',
  props: {
    authType: {
      type: String,
      default: 'ssh',
      enum: ['basic', 'ssh']
    },
    repoUrl: String,
    branch: {
      type: String,
      default: 'master'
    },
    verifySSL: {
      type: Boolean,
      default: true
    },
    sshPrivateKeyPath: String,
    basicUsername: String,
    basicPassword: String
  },
  activate() {

  },
  deactivate() {

  },
  created(opts) {

  },
  updated(opts) {

  },
  deleted(opts) {

  },
  renamed(opts) {

  }
}
