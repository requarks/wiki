// ------------------------------------
// Markdown - GitHub-style alerts
// ------------------------------------

/**
 * The five kinds GitHub defines, and what each one becomes here.
 *
 * They are mapped onto the admonition classes the content stylesheet already draws — the ones
 * `{.is-info}` and friends attach — so an alert and a hand-classed blockquote are the same object on
 * the page, and there is one place where an admonition is styled. `important` is the one kind with no
 * existing counterpart, and has a hue of its own in `css/_page-contents.scss`.
 *
 * The labels are English, as the marker itself is: what the renderer emits is stored as the page's
 * HTML, so nothing here can follow the reader's locale afterwards.
 */
const KINDS = new Map([
  ['note', { className: 'is-info', label: 'Note' }],
  ['tip', { className: 'is-success', label: 'Tip' }],
  ['important', { className: 'is-important', label: 'Important' }],
  ['warning', { className: 'is-warning', label: 'Warning' }],
  ['caution', { className: 'is-danger', label: 'Caution' }]
])

/**
 * The marker, and whatever the author wrote after it on the same line.
 *
 * That remainder is the admonition's title: `> [!NOTE] Read this first` is headed "Read this first"
 * rather than "Note". A deliberate step past GitHub, which renders those words as the first line of the
 * quote instead — and the step every other implementation of these takes, because a marker's own label
 * says only what kind of aside it is, never what this one is about.
 *
 * Left off, the kind's own label stands in, exactly as before. What is captured is raw markdown and is
 * parsed as such (see `titleTokens`), so a title may hold a link or a `code` span like any other line.
 */
const MARKER = /^\[!([a-z]+)\][ \t]*([^\n]*)(?:\n|$)/i

/**
 * The title, as three tokens: a paragraph carrying a class, its inline content, and the close.
 *
 * The inline token is left with nothing but `content`; the core `inline` rule runs after this one and
 * is what turns that into children, the same as for every other paragraph on the page — which is also
 * what lets an author's own title carry markdown, and what keeps it escaped if it carries anything else.
 */
function titleTokens(state, title) {
  const open = new state.Token('paragraph_open', 'p', 1)
  open.attrSet('class', 'alert-title')
  open.block = true

  const inline = new state.Token('inline', '', 0)
  inline.content = title
  inline.children = []

  const close = new state.Token('paragraph_close', 'p', -1)
  close.block = true

  return [open, inline, close]
}

export default (md) => {
  /*
    After `block` and so before `inline`, which is what makes this a matter of cutting a line off a
    string: at this point a paragraph is still one `inline` token holding its raw source. Run after
    `inline` instead and the same job means walking children and reasoning about where markdown-it put
    the break — a soft one, or a hard one where the author left two spaces after the marker, as the
    examples in GitHub's own documentation do.
  */
  md.core.ruler.after('block', 'github_alert', (state) => {
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i++) {
      if (
        tokens[i].type !== 'blockquote_open' ||
        tokens[i + 1]?.type !== 'paragraph_open' ||
        tokens[i + 2]?.type !== 'inline'
      ) {
        continue
      }

      const marker = MARKER.exec(tokens[i + 2].content)
      const kind = marker ? KINDS.get(marker[1].toLowerCase()) : null
      if (!kind) {
        continue
      }

      // -> Joined rather than set: an author may have classed the quote themselves, and `is-info` on
      //    top of that is what the stylesheet is written to expect
      tokens[i].attrJoin('class', kind.className)

      // -> A title of nothing but spaces is no title: the kind says what it is instead
      const title = marker[2].trim() || kind.label

      const rest = tokens[i + 2].content.slice(marker[0].length)
      if (rest) {
        tokens[i + 2].content = rest
        tokens.splice(i + 1, 0, ...titleTokens(state, title))
      } else {
        // -> The marker line was the whole paragraph, so the title takes its place rather than joining it
        tokens.splice(i + 1, 3, ...titleTokens(state, title))
      }
    }
  })
}
