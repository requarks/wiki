const mdKatex = require('@liradb2000/markdown-it-katex')

// ------------------------------------
// Markdown - Katex
// ------------------------------------

module.exports = {
  init (md, conf) {
    md.use(mdKatex)
  }
}
