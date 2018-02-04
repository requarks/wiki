const mdEmoji = require('markdown-it-emoji')

// ------------------------------------
// Markdown - Emoji
// ------------------------------------

module.exports = {
  key: 'markdown/emoji',
  title: 'Emoji',
  dependsOn: [],
  props: [],
  init (md, conf) {
    md.use(mdEmoji)
  }
}
