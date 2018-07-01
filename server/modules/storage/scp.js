module.exports = {
  key: 'scp',
  title: 'SCP (SSH)',
  props: {
    host: String,
    port: {
      type: Number,
      default: 22
    },
    username: String,
    privateKeyPath: String,
    basePath: {
      type: String,
      default: '~'
    }
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
