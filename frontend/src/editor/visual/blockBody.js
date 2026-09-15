/**
 * The fenced source a block component carries, read out and written back.
 *
 * The counterpart of `helpers/markdownBlocks.js`, which does this by line number over a whole page's
 * text. Here the block is a node and its body is a string of its own, so there is nothing to locate —
 * only the fence to take off and put back. Kept apart from the schema and the parser because it is
 * about what is INSIDE a block, which is the block's business rather than the document's.
 */

/** A fenced block: the opening fence and its info string, the body, and the closing fence. */
const FENCED = /^ {0,3}(`{3,}|~{3,})[ \t]*([^\s`]*)[^\n]*\n([\s\S]*?)\n? {0,3}\1[ \t]*$/

/**
 * @param {string} body A block's body, as stored on the node.
 * @returns {?{ lang: string, source: string }} Null when the body is not a single fenced source,
 *          which is what a block with a content editor always holds — see `bodyIsContent` in
 *          `parse.js`, which is the rule that decided this block is an atom in the first place.
 */
export function readFencedBody(body) {
  const match = FENCED.exec((body ?? '').trim())
  if (!match) {
    return null
  }
  return { lang: match[2] ?? '', source: match[3] ?? '' }
}

/**
 * The same body with a new source in it, fenced the way it was.
 *
 * The fence is grown past anything in the source that would close it early, exactly as the
 * serialiser does for a code block: a draw.io diagram's XML is not going to contain a run of
 * backticks, but a source somebody pasted might.
 *
 * @param {string} body The body as it stands, for the language and fence style to keep.
 * @param {string} source The new source.
 */
export function writeFencedBody(body, source) {
  const existing = readFencedBody(body)
  const lang = existing?.lang ?? ''
  const runs = source.match(/`{3,}/gm)
  const fence = runs ? `${runs.sort().at(-1)}\`` : '```'
  return `${fence}${lang}\n${source}\n${fence}`
}
