/**
 * Inline math, written `` $`E = mc^2`$ `` and drawn by a math block in `inline` mode.
 *
 * The syntax GitHub and GitLab both accept, chosen for two things the bare `$…$` cannot offer:
 *
 * - **It has to be asked for.** A dollar sign is only ever math when a backtick sits right against
 *   it, so `$5 and $10`, `$HOME` and a shell sample in a sentence are left exactly as they were. There
 *   is no rule about digits or spacing to guess with.
 * - **The TeX arrives as typed.** The inside is a code span in all but name, so a backslash, `_`,
 *   `^` and `\\` reach the block untouched — the same reason the display blocks insist on a fence.
 *   And a renderer that does not know the syntax still shows the formula, as a dollar and some code.
 *
 * The span follows a code span's rules, which is what makes it predictable to anybody who writes
 * markdown: it opens on a run of backticks and closes on the first run of the same length, so a
 * formula holding a backtick is written with two (`` $``a`b``$ ``). The closing run has to be followed
 * by a `$` for any of it to be math; otherwise it is left alone, and reads as a dollar followed by an
 * ordinary code span. `` \$`x`$ `` is the way to write that on purpose.
 *
 * What is emitted is the block's own element with the source as its text, which is all a page needs:
 * the article loads `/_blocks/<tag>.js` for any element it finds undefined, so KaTeX or MathJax is
 * fetched by the first page that holds a formula and by no other.
 *
 * @param {import('markdown-it').default} md
 * @param {object} options
 * @param {string} options.tag The block that draws it, `block-katex` or `block-mathjax`.
 */
export default function inlineMath(md, { tag }) {
  md.inline.ruler.before('backticks', 'math_inline', (state, silent) => {
    const start = state.pos
    const max = state.posMax
    if (state.src.charCodeAt(start) !== 0x24 /* $ */ || state.src.charCodeAt(start + 1) !== 0x60) {
      return false
    }

    // -> The opening run, and then the first run of exactly that many: longer or shorter is content
    let pos = start + 1
    while (pos < max && state.src.charCodeAt(pos) === 0x60 /* ` */) {
      pos++
    }
    const fence = pos - start - 1
    const contentStart = pos

    let closeStart = -1
    while (pos < max) {
      if (state.src.charCodeAt(pos) !== 0x60) {
        pos++
        continue
      }
      const runStart = pos
      while (pos < max && state.src.charCodeAt(pos) === 0x60) {
        pos++
      }
      if (pos - runStart === fence) {
        closeStart = runStart
        break
      }
    }
    if (closeStart < 0 || pos >= max || state.src.charCodeAt(pos) !== 0x24) {
      return false
    }

    if (!silent) {
      /*
        Normalised as a code span's content is: a line break is a space, and one space either side is
        dropped where both are there — which is what lets a formula that starts or ends with a backtick
        be written at all.
      */
      let content = state.src.slice(contentStart, closeStart).replace(/\n/g, ' ')
      if (/^ .* $/.test(content) && content.trim()) {
        content = content.slice(1, -1)
      }
      const token = state.push('math_inline', tag, 0)
      // -> The whole of what was written, for the Visual editor to keep as it stands
      token.markup = state.src.slice(start, pos + 1)
      token.content = content
    }
    state.pos = pos + 1
    return true
  })

  /*
    `inline="true"` rather than the bare attribute: the sanitiser drops an attribute with an empty
    value, and Lit reads a Boolean property from the attribute's presence, not from what it says.
  */
  md.renderer.rules.math_inline = (tokens, idx) => {
    const token = tokens[idx]
    return `<${token.tag} inline="true">${md.utils.escapeHtml(token.content)}</${token.tag}>`
  }
}
