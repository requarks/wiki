const mdMathjax = require('markdown-it-mathjax')()

// ------------------------------------
// Markdown - Mathjax Preprocessor
// ------------------------------------

module.exports = {
  key: 'markdown/mathjax',
  title: 'Mathjax Preprocessor',
  dependsOn: [],
  props: [],
  init (md, conf) {
    md.use(mdMathjax)
  }
}
