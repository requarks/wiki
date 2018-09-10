const mdImsize = require('markdown-it-imsize')

// ------------------------------------
// Markdown - Image Size
// ------------------------------------

module.exports = {
  init (md, conf) {
    md.use(mdImsize)
  }
}
