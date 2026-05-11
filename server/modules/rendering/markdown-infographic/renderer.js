// ------------------------------------
// Markdown - AntV Infographic Preprocessor
// ------------------------------------

const infographicPlugin = require('./plugin')

module.exports = {
  init (mdinst, conf) {
    mdinst.use(infographicPlugin)
  }
}
