import { DIAGRAM_LANGUAGES, parseFenceAttributes } from '@/renderers/shared'

/**
 * Fenced code blocks in a page's markdown source, as the editor reads them.
 *
 * Which lines a fence covers is asked by the block helpers -- a block written inside a code sample is
 * a code sample -- and by the editor's help with writing a fence: closing one as it is opened, and
 * completing its language and attributes. So the reading is kept here once.
 */

/** The opening or closing line of a fenced block, indented up to the three spaces markdown allows. */
export const FENCE = /^ {0,3}(`{3,}|~{3,})/

/**
 * What each line of the source is to the fences in it: `open`, `close`, `inside` or `outside`.
 *
 * A closing fence is the same character as the one that opened and at least as long; anything else
 * that looks like a fence while one is open is a line of its code.
 *
 * @param {string[]} lines The page source, split into lines.
 * @returns {Generator<'open'|'close'|'inside'|'outside'>} One per line, in order.
 */
function* fenceRoles(lines) {
  let fence = null
  for (const line of lines) {
    const edge = FENCE.exec(line)
    if (fence) {
      if (edge && edge[1][0] === fence[0] && edge[1].length >= fence.length) {
        fence = null
        yield 'close'
      } else {
        yield 'inside'
      }
    } else if (edge) {
      fence = edge[1]
      yield 'open'
    } else {
      yield 'outside'
    }
  }
}

/** The role of one line, read off everything above it. */
function fenceRoleOf(lines, index) {
  let current = 0
  for (const role of fenceRoles(lines)) {
    if (current === index) {
      return role
    }
    current++
  }
  return 'outside'
}

/**
 * The index of every line that is not inside a fenced code block, nor one of its fences, in order.
 *
 * @param {string[]} lines The page source, split into lines.
 * @returns {Generator<number>}
 */
export function* linesOutsideFences(lines) {
  let index = 0
  for (const role of fenceRoles(lines)) {
    if (role === 'outside') {
      yield index
    }
    index++
  }
}

/**
 * Whether a line is outside every fenced code block.
 *
 * @param {string[]} lines The page source, split into lines.
 * @param {number} index 0-based.
 */
export function isOutsideFences(lines, index) {
  return fenceRoleOf(lines, index) === 'outside'
}

/**
 * Whether the fences in these lines all pair up, read from the top as if nothing were open above them.
 *
 * @param {string[]} lines
 */
function fencesBalanced(lines) {
  let open = false
  for (const role of fenceRoles(lines)) {
    if (role === 'open') {
      open = true
    } else if (role === 'close') {
      open = false
    }
  }
  return !open
}

/** A line that is three backticks and nothing else, indented as far as markdown allows. */
const BARE_BACKTICK_FENCE = /^( {0,3})```$/

/**
 * Whether a line has just become the OPENING of a code block -- three backticks and nothing else -- and
 * so whether the editor should close it and offer a language.
 *
 * `unclosed` says nothing below closes it, and is decided by whether the fences BELOW this line pair up
 * among themselves. They do when the author is starting a new block above existing ones, each of which
 * has its own closing fence; they do not when the author is retyping the opening of a block that
 * already has one, whose closing fence is then the odd one out below. Only the first wants another
 * closing fence -- in the second, adding one would cut the block in two.
 *
 * @param {string} text The page source.
 * @param {number} line 1-based.
 * @returns {{ indent: string, unclosed: boolean } | null}
 */
export function fenceJustOpened(text, line) {
  const lines = text.split('\n')
  const opening = BARE_BACKTICK_FENCE.exec(lines[line - 1] ?? '')
  if (!opening || fenceRoleOf(lines, line - 1) !== 'open') {
    return null
  }
  return { indent: opening[1], unclosed: fencesBalanced(lines.slice(line)) }
}

/** An opening fence and the language after it, which may be partly typed or not typed at all. */
const FENCE_LANGUAGE = /^( {0,3}(?:`{3,}|~{3,}))([^\s`]*)/

/**
 * Whether the caret is in a fence's LANGUAGE, for the editor to offer the languages it could be.
 *
 * Only on an opening fence. `startColumn` and `endColumn` span the whole language word, the part after
 * the caret included, so that picking one replaces it rather than splicing into it.
 *
 * @param {string} text The page source.
 * @param {number} line 1-based.
 * @param {number} column 1-based, as Monaco counts it.
 * @returns {{ startColumn: number, endColumn: number } | null}
 */
export function fenceLanguageContext(text, line, column) {
  const lines = text.split('\n')
  const opening = FENCE_LANGUAGE.exec(lines[line - 1] ?? '')
  if (!opening) {
    return null
  }
  const start = opening[1].length
  const end = opening[0].length
  if (column - 1 < start || column - 1 > end || fenceRoleOf(lines, line - 1) !== 'open') {
    return null
  }
  return { startColumn: start + 1, endColumn: end + 1 }
}

/**
 * The attributes a fence may carry after its language, in the order they are offered. Spelled as the
 * renderer documents them; it reads them case-insensitively. See `parseFenceAttributes`.
 */
export const FENCE_ATTRIBUTES = ['title', 'linesStart', 'linesHighlight']

/** An opening fence, its language, and the whitespace that ends the language. */
const FENCE_INFO = /^( {0,3}(?:`{3,}|~{3,}))([^\s`]+)[ \t]/

/**
 * Whether the caret is where a fence attribute's NAME goes, for the editor to offer the ones not given.
 *
 * Only on an OPENING fence and only after its language: markdown-it takes the first word of the info
 * string as the language whatever it says, so `title="x"` written with no language before it would be
 * read as a language called that. A diagram fence is left out too, since it is a source for a block to
 * draw and the renderer ignores all three there. And only where a name goes -- after whitespace, not
 * inside a value or butted up against the quote that closes one. None of the three has a fixed set of
 * values to offer.
 *
 * `written` holds the attributes the line already gives, in lower case as the renderer reads them, less
 * the one under the caret.
 *
 * @param {string} text The page source.
 * @param {number} line 1-based.
 * @param {number} column 1-based, as Monaco counts it.
 * @returns {{ written: Set<string>, startColumn: number } | null}
 */
export function fenceAttributeContext(text, line, column) {
  const lines = text.split('\n')
  const source = lines[line - 1] ?? ''
  const opening = FENCE_INFO.exec(source)
  if (!opening || DIAGRAM_LANGUAGES.includes(opening[2])) {
    return null
  }
  const base = opening[1].length + opening[2].length
  if (column - 1 <= base || fenceRoleOf(lines, line - 1) !== 'open') {
    return null
  }

  const inside = source.slice(base)
  const caret = column - 1 - base
  let quote = null
  // -> Where the token under the caret began, or -1 right after a closing quote
  let tokenStart = 0
  for (let index = 0; index < caret; index++) {
    const char = inside[index]
    if (quote) {
      if (char === '\\') {
        index++
      } else if (char === quote) {
        quote = null
        tokenStart = -1
      }
    } else if (char === '"' || char === "'") {
      quote = char
    } else if (char === ' ' || char === '\t') {
      tokenStart = index + 1
    }
  }
  const token = tokenStart < 0 ? '' : inside.slice(tokenStart, caret)
  if (quote || tokenStart < 0 || token.includes('=')) {
    return null
  }

  // -> The line without the token under the caret, which may be a name being retyped
  const tokenEnd = caret + /^\S*/.exec(inside.slice(caret))[0].length
  const rest = `${inside.slice(0, tokenStart)} ${inside.slice(tokenEnd)}`
  return {
    written: new Set(Object.keys(parseFenceAttributes(rest))),
    startColumn: base + tokenStart + 1
  }
}
