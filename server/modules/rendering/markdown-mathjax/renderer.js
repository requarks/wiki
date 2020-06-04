const mjax = require('mathjax')

/* global WIKI */

// ------------------------------------
// Markdown - MathJax Renderer
// ------------------------------------

const extensions = [
  'bbox',
  'boldsymbol',
  'braket',
  'color',
  'extpfeil',
  'mhchem',
  'newcommand',
  'unicode',
  'verb'
]

module.exports = {
  async init (mdinst, conf) {
    const MathJax = await mjax.init({
      loader: {
        require: require,
        paths: { mathjax: 'mathjax/es5' },
        load: [
          'input/tex',
          'output/svg',
          ...extensions.map(e => `[tex]/${e}`)
        ]
      },
      tex: {
        packages: {'[+]': extensions}
      }
    })
    if (conf.useInline) {
      mdinst.inline.ruler.after('escape', 'mathjax_inline', mathjaxInline)
      mdinst.renderer.rules.mathjax_inline = (tokens, idx) => {
        try {
          const result = MathJax.tex2svg(tokens[idx].content, {
            display: false
          })
          return MathJax.startup.adaptor.innerHTML(result)
        } catch (err) {
          WIKI.logger.warn(err)
          return tokens[idx].content
        }
      }
    }
    if (conf.useBlocks) {
      mdinst.block.ruler.after('blockquote', 'mathjax_block', mathjaxBlock, {
        alt: [ 'paragraph', 'reference', 'blockquote', 'list' ]
      })
      mdinst.renderer.rules.mathjax_block = (tokens, idx) => {
        try {
          const result = MathJax.tex2svg(tokens[idx].content, {
            display: true
          })
          return `<p>` + MathJax.startup.adaptor.innerHTML(result) + `</p>`
        } catch (err) {
          WIKI.logger.warn(err)
          return tokens[idx].content
        }
      }
    }
  }
}

// Test if potential opening or closing delimieter
// Assumes that there is a "$" at state.src[pos]
function isValidDelim (state, pos) {
  let prevChar
  let nextChar
  let max = state.posMax
  let canOpen = true
  let canClose = true

  prevChar = pos > 0 ? state.src.charCodeAt(pos - 1) : -1
  nextChar = pos + 1 <= max ? state.src.charCodeAt(pos + 1) : -1

  // Check non-whitespace conditions for opening and closing, and
  // check that closing delimeter isn't followed by a number
  if (prevChar === 0x20/* " " */ || prevChar === 0x09/* \t */ ||
  (nextChar >= 0x30/* "0" */ && nextChar <= 0x39/* "9" */)) {
    canClose = false
  }
  if (nextChar === 0x20/* " " */ || nextChar === 0x09/* \t */) {
    canOpen = false
  }

  return {
    canOpen: canOpen,
    canClose: canClose
  }
}

function mathjaxInline (state, silent) {
  let start, match, token, res, pos

  if (state.src[state.pos] !== '$') { return false }

  res = isValidDelim(state, state.pos)
  if (!res.canOpen) {
    if (!silent) { state.pending += '$' }
    state.pos += 1
    return true
  }

  // First check for and bypass all properly escaped delimieters
  // This loop will assume that the first leading backtick can not
  // be the first character in state.src, which is known since
  // we have found an opening delimieter already.
  start = state.pos + 1
  match = start
  while ((match = state.src.indexOf('$', match)) !== -1) {
    // Found potential $, look for escapes, pos will point to
    // first non escape when complete
    pos = match - 1
    while (state.src[pos] === '\\') { pos -= 1 }

    // Even number of escapes, potential closing delimiter found
    if (((match - pos) % 2) === 1) { break }
    match += 1
  }

  // No closing delimter found.  Consume $ and continue.
  if (match === -1) {
    if (!silent) { state.pending += '$' }
    state.pos = start
    return true
  }

  // Check if we have empty content, ie: $$.  Do not parse.
  if (match - start === 0) {
    if (!silent) { state.pending += '$$' }
    state.pos = start + 1
    return true
  }

  // Check for valid closing delimiter
  res = isValidDelim(state, match)
  if (!res.canClose) {
    if (!silent) { state.pending += '$' }
    state.pos = start
    return true
  }

  if (!silent) {
    token = state.push('mathjax_inline', 'math', 0)
    token.markup = '$'
    token.content = state.src.slice(start, match)
  }

  state.pos = match + 1
  return true
}

function mathjaxBlock (state, start, end, silent) {
  let firstLine; let lastLine; let next; let lastPos; let found = false; let token
  let pos = state.bMarks[start] + state.tShift[start]
  let max = state.eMarks[start]

  if (pos + 2 > max) { return false }
  if (state.src.slice(pos, pos + 2) !== '$$') { return false }

  pos += 2
  firstLine = state.src.slice(pos, max)

  if (silent) { return true }
  if (firstLine.trim().slice(-2) === '$$') {
    // Single line expression
    firstLine = firstLine.trim().slice(0, -2)
    found = true
  }

  for (next = start; !found;) {
    next++

    if (next >= end) { break }

    pos = state.bMarks[next] + state.tShift[next]
    max = state.eMarks[next]

    if (pos < max && state.tShift[next] < state.blkIndent) {
      // non-empty line with negative indent should stop the list:
      break
    }

    if (state.src.slice(pos, max).trim().slice(-2) === '$$') {
      lastPos = state.src.slice(0, max).lastIndexOf('$$')
      lastLine = state.src.slice(pos, lastPos)
      found = true
    }
  }

  state.line = next + 1

  token = state.push('mathjax_block', 'math', 0)
  token.block = true
  token.content = (firstLine && firstLine.trim() ? firstLine + '\n' : '') +
  state.getLines(start + 1, next, state.tShift[start], true) +
  (lastLine && lastLine.trim() ? lastLine : '')
  token.map = [ start, state.line ]
  token.markup = '$$'
  return true
}
