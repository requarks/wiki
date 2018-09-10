const mdSub = require('markdown-it-sub')
const mdSup = require('markdown-it-sup')

// ------------------------------------
// Markdown - Subscript / Superscript
// ------------------------------------

module.exports = {
  init (md, conf) {
    if (conf.subEnabled) {
      md.use(mdSub)
    }
    if (conf.supEnabled) {
      md.use(mdSup)
    }
  }
}
