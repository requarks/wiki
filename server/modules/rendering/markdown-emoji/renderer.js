const { full: mdEmoji } = require('markdown-it-emoji')
const twemoji = require('twemoji')

// ------------------------------------
// Markdown - Emoji
// ------------------------------------

module.exports = {
  init (md, conf) {
    md.use(mdEmoji)

    md.renderer.rules.emoji = (token, idx) => {
      return twemoji.parse(token[idx].content, {
        callback (icon, opts) {
          return `/_assets/svg/twemoji/${icon}.svg`
        }
      })
    }
  }
}
