import { createProseMarkdown } from './comment.js'

/**
 * The markdown an idea on a feedback board is submitted in: a comment's, link for link.
 *
 * The submission form is a comment box in all but name — whoever holds `write:feedback`, which on a
 * public board is every account — so it gets the comment's feature set and its `rel`: no headings, no
 * images, no tables, no raw HTML, and links that leave with `nofollow ugc noopener`. Mentions are not
 * linked, since an idea addresses the board rather than somebody in particular.
 *
 * Unlike a comment, the result is STORED: an idea is a page, and a page's render is produced by the
 * browser that changed it. So the restriction here is not the security boundary, since a request can
 * send any render it likes: the server holds the render to the elements this markdown produces
 * (`sanitizeProse` in the backend's `helpers/sanitizeRender.ts`, which has to keep up with the rules
 * enabled in `createProseMarkdown`). The source is a page's markdown like any other, so somebody who
 * may write the page can go on to edit it in the full editor.
 */
const md = createProseMarkdown({ rel: 'nofollow ugc noopener' })

/**
 * A board's introduction, and its submission notice, in the same markdown. Rendered at display time
 * from the source the board stores, never stored as HTML -- the comment renderer's arrangement, and
 * its security boundary (`html: false`). Links lose `nofollow ugc`, as a glossary definition's do: both
 * are written by whoever may write the board's front page, not by whoever may submit to it.
 */
const introMd = createProseMarkdown({ rel: 'noopener' })

/**
 * Render an idea's description.
 *
 * @param {string} source Markdown as it was typed
 * @returns {string} HTML, safe to hand to `v-html`: nothing in it came from the source unescaped
 */
export function renderIdea(source) {
  return md.render(source ?? '')
}

/**
 * Render a board's introduction, or the notice at the top of its submission form: both are written by
 * whoever may write the board's front page, so both get the same rules.
 *
 * @param {string} source Markdown as it was typed
 * @returns {string} HTML, safe to hand to `v-html`: nothing in it came from the source unescaped
 */
export function renderBoardIntro(source) {
  return introMd.render(source ?? '')
}

export default renderIdea
