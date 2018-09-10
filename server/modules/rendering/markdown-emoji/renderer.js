const mdEmoji = require('markdown-it-emoji')

// ------------------------------------
// Markdown - Emoji
// ------------------------------------

module.exports = {
  init (md, conf) {
    md.use(mdEmoji)
  }
}
