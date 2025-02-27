/* global WIKI */
export default function mentionPlugin(md) {
  md.inline.ruler.before(
    'emphasis',
    'mention',
    function mention(state, silent) {
      const mentionPattern = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]*|[a-zA-Z0-9._%+-]*)/g
      let match
      while ((match = mentionPattern.exec(state.src.slice(state.pos))) !== null) {
        if (!match) return false

        const mentions = WIKI.$store.get('editor/mentions')

        if (!silent) {
          const token = state.push('mention_open', 'a', 1)
          token.content = match[0]
          token.attrs = [
            ['class', mentions.includes(match[1]) ? 'mention' : 'incomplete-mention']
          ]
          state.push('mention_close', 'a', -1)
        }

        state.pos += match[0].length
      }
      return true
    }
  )

  md.renderer.rules.mention_open = function (tokens, idx) {
    const className = tokens[idx].attrs.find(attr => attr[0] === 'class')[1]
    return `<span class="${className}" data-mention="@${tokens[idx].content}">${tokens[idx].content}`
  }

  md.renderer.rules.mention_close = function () {
    return '</span>'
  }
}
