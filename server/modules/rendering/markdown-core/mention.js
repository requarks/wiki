module.exports = function mentionPlugin(md) {
  md.inline.ruler.before('emphasis', 'mention', mention)

  md.renderer.rules.mention_open = function (tokens, idx) {
    return `<span class="mention" data-mention="${tokens[idx].content.slice(1)}">${tokens[idx].content}`
  }

  md.renderer.rules.mention_close = function () {
    return '</span>'
  }
}

function mention(state, silent) {
  const mentionPattern = /^@[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}$/
  const emailPattern = /^[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}$/
  let pos = state.pos

  if (!isAtSymbol(state, pos)) {
    return false
  }

  const mentionCandidate = getMentionCandidate(state, pos)
  if (!isValidMention(mentionCandidate, emailPattern)) {
    return false
  }

  const match = mentionPattern.exec(mentionCandidate)
  if (!match && mentionCandidate.slice(1) !== 'AnonymousUser') {
    return false
  }

  if (!silent) {
    pushMentionToken(state, match, mentionCandidate)
  }

  state.pos += match ? match.index + match[0].length : mentionCandidate.length
  return true
}

function isAtSymbol(state, pos) {
  return state.src.charAt(pos) === '@'
}

function getMentionCandidate(state, pos) {
  const mentionPattern = /@(?:[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}|AnonymousUser)/g
  mentionPattern.lastIndex = pos
  const match = mentionPattern.exec(state.src)
  const end = match ? match.index + match[0].length : state.src.length
  return state.src.slice(pos, end)
}

function isValidMention(mentionCandidate, emailPattern) {
  const isEmailAddress = emailPattern.test(mentionCandidate.slice(1))
  const isAnonymousUser = mentionCandidate.slice(1) === 'AnonymousUser'
  return isEmailAddress || (!isEmailAddress && isAnonymousUser)
}

function pushMentionToken(state, match, mentionCandidate) {
  const token = state.push('mention_open', 'a', 1)
  token.content = match ? match[0] : mentionCandidate
  state.push('mention_close', 'a', -1)
}
