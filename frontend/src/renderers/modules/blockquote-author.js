// ------------------------------------
// Markdown - Blockquote attribution
// ------------------------------------

import { escape } from 'es-toolkit/string'

/**
 * Who a quote is from, written the way HedgeDoc writes it: `> [name=John Doe] Some text here`.
 *
 * Only at the very start of a quote, which is where an attribution is drawn — a `[name=…]` anywhere
 * else is left as the text it is. The rest of the line is the quote's first line, and a marker on a
 * line of its own (`> [name=John Doe]`, then the quote below) is the same thing: the newline after it
 * goes with the marker, so the paragraph it opened carries on from the next line.
 *
 * A name of nothing but spaces is no name, and the marker is left alone.
 */
export const MARKER = /^\[name=([^\]\n]*[^\]\s][^\]\n]*)\][ \t]*\n?/i

/** The icon the attribution line is drawn with, ahead of the name. */
export const AUTHOR_ICON = 'mdi:user'

/**
 * The attribution line as markup: a dash, the icon and the name, in a paragraph the content stylesheet
 * dresses as the quote's byline.
 *
 * The name is text and is escaped as such, never parsed: it is somebody's name, not a line of
 * markdown. The icon is an `<iconify-icon>`, which `models/rendering.ts` draws into the page as an
 * `<svg>` when it is saved.
 */
export function authorHtml(name, attrs = '') {
  return `<p class="blockquote-author"${attrs}><span class="blockquote-author-dash">—</span><iconify-icon icon="${AUTHOR_ICON}"></iconify-icon><span class="blockquote-author-name">${escape(name)}</span></p>\n`
}

export default (md) => {
  /*
    After `block` and so before `inline`, for the reason the GitHub alert rule is: a paragraph is still
    one `inline` token holding its raw source, so taking the marker off is cutting a string. It also has
    to be done before the inline rules ever see it, since MDC's inline span would otherwise claim the
    brackets and draw `[name=John Doe]` as a `<span>`.
  */
  md.core.ruler.after('block', 'blockquote_author', (state) => {
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
      if (!marker) {
        continue
      }

      const author = new state.Token('blockquote_author', 'p', 0)
      author.block = true
      author.content = marker[1].trim()
      // -> The marker's own line, so the editor's scroll sync has something to place it by
      author.map = tokens[i + 1].map ? [tokens[i + 1].map[0], tokens[i + 1].map[0] + 1] : null

      const rest = tokens[i + 2].content.slice(marker[0].length)
      if (rest.trim()) {
        tokens[i + 2].content = rest
        tokens.splice(i + 1, 0, author)
      } else {
        // -> The marker was the whole paragraph, so the attribution takes its place
        tokens.splice(i + 1, 3, author)
      }
    }
  })

  md.renderer.rules.blockquote_author = (tokens, idx) => {
    const { map, content } = tokens[idx]
    const line = map ? ` data-line="${map[0] + 1}" data-line-end="${map[1]}"` : ''
    return authorHtml(content, line)
  }
}
