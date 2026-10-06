import { createProseMarkdown } from './comment.js'

/**
 * The markdown a glossary definition may be written in: a comment's, link for link.
 *
 * The same feature set and the same security boundary (`html: false` -- see `renderers/comment.js`), so
 * nothing stored is ever HTML. Two differences, both about who wrote it: links lose `nofollow ugc`,
 * since a definition is written by somebody holding `manage:glossary` rather than by whoever may
 * comment, and `@handle` is not a mention, since nobody is being addressed.
 */
const md = createProseMarkdown({ rel: 'noopener' })

/**
 * Render one definition.
 *
 * @param {string} source Markdown as it was typed
 * @returns {string} HTML, safe to hand to `v-html`: nothing in it came from the source unescaped
 */
export function renderDefinition(source) {
  return md.render(source ?? '')
}

export default renderDefinition
