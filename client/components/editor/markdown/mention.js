
export default function mentionPlugin(md) {
  md.inline.ruler.before(
    'emphasis',
    'mention',
    function mention(state, silent) {
      const mentionPattern = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]*|[a-zA-Z0-9._%+-]*)/g
      let match
      while ((match = mentionPattern.exec(state.src.slice(state.pos))) !== null) {
        if (!match) return false

        if (!silent) {
          const token = state.push('mention_open', 'a', 1)
          token.content = match[0]
          state.push('mention_close', 'a', -1)
        }

        state.pos += match[0].length
      }
      return true
    }
  )

  md.renderer.rules.mention_open = function (tokens, idx) {
    return `<span class="mention" data-mention="@${tokens[idx].content}">${tokens[idx].content}`
  }

  md.renderer.rules.mention_close = function () {
    return '</span>'
  }
}
