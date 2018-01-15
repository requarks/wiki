const mdAbbr = require('markdown-it-abbr')

// ------------------------------------
// Markdown - Abbreviations
// ------------------------------------

module.exports = {
  key: 'markdown/abbreviations',
  title: 'Abbreviations',
  dependsOn: [],
  props: [],
  init (md, conf) {
    md.use(mdAbbr)
  }
}
