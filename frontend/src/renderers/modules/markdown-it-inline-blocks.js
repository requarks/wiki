/**
 * Inline blocks, written `:block-color[#ff6600]` or `:block-timestamp[2026-11-03T14:00Z]{format="relative"}`.
 *
 * MDC's own inline component syntax -- one colon where a block on its own line has two -- held to
 * the wiki's blocks. MDC's rule for it stays off (see `markdown.js`): it takes ANY name, and with it on
 * every `:rocket:` came out as a `<rocket>` element. Here the name has to be `block-…` and a `[` has to
 * follow it at once, so an emoji shortcode, an icon (`:mdi:home:`) and a colon in a sentence are all
 * left exactly as they were.
 *
 * - **The value is between the brackets, as written.** It is taken the way a code span's content is
 *   -- no emphasis, no links, no typographer quotes -- since what goes there is a date or a colour code,
 *   and `_` or `--` inside one is not markup. A `]` that belongs to the value is written `\]`, and a
 *   backslash `\\`.
 * - **It stays the element's text.** `<block-color>#ff6600</block-color>` reads correctly before the
 *   component loads, in a search index, and on a site that switched the block off -- the sanitiser
 *   drops a tag it does not allow and keeps what is inside.
 * - **Props are MDC's `{…}`, read by MDC's own rule**, so they are written exactly as a block's are.
 *   They have to touch the closing bracket; a brace after a space is `markdown-it-attrs` addressing
 *   the paragraph.
 *
 * Which blocks are inline is not this rule's business: it has no list of them, the same as MDC has
 * none for blocks on their own line. A block that is not inline written this way renders as an empty
 * element of that block, which its preview shows plainly enough.
 *
 * @param {import('markdown-it').default} md
 */
export default function inlineBlocks(md) {
  const propsRule = md.inline.ruler.__rules__.find((rule) => rule.name === 'mdc_inline_props')?.fn

  /*
    MDC's block SHORTHAND, `:name[content]{props}` as a whole line, is a block on a line of its own --
    so a line holding nothing but an inline block was claimed by it before this rule ever saw it.
    That line rendered with no paragraph round it, and the Visual editor, which has no node for the
    shorthand, threw on it: inserting an inline block there parses the snippet as a line of its own,
    so every insert failed. A line opening with `:block-…[` is this syntax, and is left to be a
    paragraph; the shorthand keeps everything else, `:block-map{…}` included.
  */
  const shorthandRule = md.block.ruler.__rules__.find((rule) => rule.name === 'mdc_block_shorthand')
  if (shorthandRule) {
    const blockShorthand = shorthandRule.fn
    md.block.ruler.at('mdc_block_shorthand', (state, startLine, endLine, silent) => {
      const start = state.bMarks[startLine] + state.tShift[startLine]
      if (/^:block-[a-z0-9][a-z0-9-]*\[/.test(state.src.slice(start, state.eMarks[startLine]))) {
        return false
      }
      return blockShorthand(state, startLine, endLine, silent)
    })
  }

  md.inline.ruler.after('entity', 'block_inline', (state, silent) => {
    const start = state.pos
    const max = state.posMax
    const src = state.src
    if (src.charCodeAt(start) !== 0x3a /* : */) {
      return false
    }
    // -> Not glued to a word or to another colon: `a:block-x[…]` and `::block-x` are something else
    const previous = src[start - 1]
    if (start > 0 && /[\p{L}\p{N}:]/u.test(previous)) {
      return false
    }

    const name = /^block-[a-z0-9][a-z0-9-]*/.exec(src.slice(start + 1, max))
    if (!name) {
      return false
    }
    let pos = start + 1 + name[0].length
    if (src.charCodeAt(pos) !== 0x5b /* [ */) {
      return false
    }

    // -> The value runs to the first `]` not escaped with a backslash
    pos++
    const valueStart = pos
    while (pos < max && src.charCodeAt(pos) !== 0x5d /* ] */) {
      pos += src.charCodeAt(pos) === 0x5c /* \ */ ? 2 : 1
    }
    if (pos >= max) {
      return false
    }
    const value = src.slice(valueStart, pos)
    pos++

    let token = null
    if (!silent) {
      token = state.push('block_inline', name[0], 0)
      token.content = value.replace(/\\([\\\]])/g, '$1').replace(/\n/g, ' ')
    }
    state.pos = pos

    /*
      The props, through MDC's rule so that the grammar is the one a block on its own line is written
      in. It pushes a token of its own for MDC to attach to whatever precedes it at render time; taken
      back off here and put on this token directly, so that nothing downstream has to know.
    */
    if (propsRule && src.charCodeAt(pos) === 0x7b /* { */ && propsRule(state, silent) && !silent) {
      token.attrs = state.tokens.pop().attrs
    }

    if (!silent) {
      // -> The whole of what was written, for the Visual editor to keep as it stands
      token.markup = src.slice(start, state.pos)
    }
    return true
  })

  md.renderer.rules.block_inline = (tokens, idx, options, env, self) => {
    const token = tokens[idx]
    return `<${token.tag}${self.renderAttrs(token)}>${md.utils.escapeHtml(token.content)}</${token.tag}>`
  }
}
