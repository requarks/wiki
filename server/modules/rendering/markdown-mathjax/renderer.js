const mdMathjax = require('markdown-it-mathjax')()

// ------------------------------------
// Markdown - Mathjax Preprocessor
// ------------------------------------

module.exports = {
  init (md, conf) {
    md.use(mdMathjax)
  }
}
