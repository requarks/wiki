// Shared markdown-it plugin for AntV Infographic fenced blocks.
//
// Captures ```infographic [params]\n{body}\n``` before the default `fence`
// rule so the info-string params are preserved (`fence` discards them by
// default in this project's highlight() pipeline).
//
// Emits a single `infographic` block token that renders to:
//   <div class="infographic" data-opts="{params}">{escaped body}</div>
//
// Used by both the server-side markdown pipeline and the client editor
// preview's markdown-it instance to keep markup symmetric.

const OPEN_MARKER = '```infographic'
const CLOSE_MARKER = '```'

function infographicRule(state, startLine, endLine, silent) {
  let start = state.bMarks[startLine] + state.tShift[startLine]
  let max = state.eMarks[startLine]

  // Quick first-char check.
  if (state.src.charCodeAt(start) !== OPEN_MARKER.charCodeAt(0)) {
    return false
  }
  // Match the full opening marker.
  if (start + OPEN_MARKER.length > max) {
    return false
  }
  for (let i = 0; i < OPEN_MARKER.length; i++) {
    if (state.src[start + i] !== OPEN_MARKER[i]) {
      return false
    }
  }

  // What follows the marker must be end-of-line or whitespace then params.
  const afterMarker = state.src.slice(start + OPEN_MARKER.length, max)
  // Reject e.g. ```infographicfoo (must be exact lang).
  if (afterMarker.length > 0 && !/^\s/.test(afterMarker)) {
    return false
  }

  if (silent) {
    return true
  }

  const params = afterMarker.trim()

  // Find the closing fence.
  let nextLine = startLine
  let autoClosed = false
  for (;;) {
    nextLine++
    if (nextLine >= endLine) {
      break
    }
    start = state.bMarks[nextLine] + state.tShift[nextLine]
    max = state.eMarks[nextLine]
    if (start < max && state.sCount[nextLine] < state.blkIndent) {
      break
    }
    if (state.src.charCodeAt(start) !== CLOSE_MARKER.charCodeAt(0)) {
      continue
    }
    if (state.sCount[nextLine] > state.sCount[startLine]) {
      continue
    }
    let closeMatched = true
    for (let i = 0; i < CLOSE_MARKER.length; i++) {
      if (state.src[start + i] !== CLOSE_MARKER[i]) {
        closeMatched = false
        break
      }
    }
    if (!closeMatched) {
      continue
    }
    if (state.skipSpaces(start + CLOSE_MARKER.length) < max) {
      continue
    }
    autoClosed = true
    break
  }

  const body = state.src
    .split('\n')
    .slice(startLine + 1, nextLine)
    .join('\n')

  const token = state.push('infographic', 'div', 0)
  token.block = true
  token.markup = OPEN_MARKER
  token.info = params
  token.content = body
  token.map = [startLine, nextLine]

  state.line = nextLine + (autoClosed ? 1 : 0)
  return true
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderRule(tokens, idx) {
  const token = tokens[idx]
  const opts = escapeAttr(token.info || '')
  const body = escapeText(token.content || '')
  return `<div class="infographic" data-opts="${opts}">${body}</div>\n`
}

module.exports = function infographicPlugin(md) {
  md.block.ruler.before('fence', 'infographic', infographicRule, {
    alt: ['paragraph', 'reference', 'blockquote', 'list']
  })
  md.renderer.rules.infographic = renderRule
}
