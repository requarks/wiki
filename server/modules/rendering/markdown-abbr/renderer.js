const mdAbbr = require('markdown-it-abbr')

// ------------------------------------
// Markdown - Abbreviations
// ------------------------------------

module.exports = {
  init (md, conf) {
    md.use(mdAbbr)
  }
}
