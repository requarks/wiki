const mdFootnote = require('markdown-it-footnote')

// ------------------------------------
// Markdown - Footnotes
// ------------------------------------

module.exports = {
  key: 'markdown/footnotes',
  title: 'Footnotes',
  dependsOn: [],
  props: [],
  init (md, conf) {
    md.use(mdFootnote)
  }
}
