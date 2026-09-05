const container = require('markdown-it-container')

module.exports = md => md.use(container, 'spoiler', {
  validate: params => /^spoiler(?:\s+.*)?$/.test(params.trim()),
  render(tokens, idx) {
    if (tokens[idx].nesting === 1) {
      const title = tokens[idx].info.trim().slice('spoiler'.length).trim() || 'Spoiler'
      return `<details class="spoiler"><summary>${md.utils.escapeHtml(title)}</summary>\n`
    }
    return '</details>\n'
  }
})
