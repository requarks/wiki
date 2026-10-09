import { createProseMarkdown } from './comment.js'

/**
 * The markdown a site's additional footer text may be written in: a comment's, rendered inline.
 *
 * The same feature set and the same security boundary (`html: false` -- see `renderers/comment.js`), so
 * nothing stored is ever HTML. Links lose `nofollow ugc`, since the text is written by somebody holding
 * `manage:sites` rather than by whoever may comment. Inline because the footer is a line of small print:
 * bold, a link or a code span belong in it, a paragraph, a list or a quote does not.
 */
const md = createProseMarkdown({ rel: 'noopener' })

/**
 * Render the footer text.
 *
 * @param {string} source Markdown as it was typed
 * @returns {string} HTML, safe to hand to `v-html`: nothing in it came from the source unescaped
 */
export function renderFooter(source) {
  return md.renderInline(source ?? '')
}

export default renderFooter
