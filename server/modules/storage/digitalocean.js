module.exports = {
  key: 'digitalocean',
  title: 'DigialOcean Spaces',
  props: {
    accessKeyId: String,
    accessSecret: String,
    region: {
      type: String,
      default: 'nyc3'
    },
    bucket: String
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
