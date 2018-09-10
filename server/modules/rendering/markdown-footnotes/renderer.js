const mdFootnote = require('markdown-it-footnote')

// ------------------------------------
// Markdown - Footnotes
// ------------------------------------

module.exports = {
  init (md, conf) {
    md.use(mdFootnote)
  }
}
