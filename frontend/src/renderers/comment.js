import MarkdownIt from 'markdown-it'

/**
 * The markdown a comment may be written in, and the whole of it.
 *
 * Deliberately not the page renderer. A page is written by somebody who was granted `write:pages` and
 * goes through a pipeline of a dozen plugins, a syntax highlighter and a sanitizer; a comment is two
 * paragraphs typed into a box by whoever may `write:comments`, which on a public wiki is anybody at
 * all. So this is a second, much smaller renderer with a different question behind it -- what is the
 * least that still reads as prose.
 *
 * **`html: false` is the security boundary**, not an afterthought. With raw HTML disabled markdown-it
 * escapes every `<` it is given, so there is no markup in the output that this file did not put
 * there and there is nothing for a sanitizer to do afterwards. That is also why the source is what
 * gets stored: no HTML is ever written to the database, so nothing can be served that was sanitized
 * by an older set of rules than the ones in force today.
 *
 * What is left out is as deliberate as what is in: no headings (a comment is not a document), no
 * images (a comment box is not an upload form, and a remote image in one is a tracking pixel), no
 * tables, no footnotes, no HTML. Links are rendered but every one of them leaves with
 * `rel="nofollow ugc noopener"` and opens in a new tab.
 */
const md = new MarkdownIt('zero', {
  html: false,
  linkify: true,
  breaks: true,
  typographer: false
})
  .enable([
    'blockquote',
    'code',
    'emphasis',
    'entity',
    'escape',
    'fence',
    'linkify',
    'list',
    'newline',
    'backticks',
    'link',
    'strikethrough'
  ])
  // -> A comment is prose, and a rule across it is furniture; a heading in one would outrank the
  //    page's own headings in the outline of the view it sits in
  .disable([
    'heading',
    'lheading',
    'hr',
    'image',
    'table',
    'reference',
    'html_block',
    'html_inline'
  ])

/**
 * Every link a comment carries, whoever wrote it.
 *
 * `nofollow ugc` because a comment box on a public wiki is a link farm otherwise -- that is what the
 * two attributes exist to say -- and `noopener` because the tab is opened by the wiki and must not
 * hand the opened page a handle back to it.
 */
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  token.attrSet('rel', 'nofollow ugc noopener')
  token.attrSet('target', '_blank')
  return self.renderToken(tokens, idx, options)
}

/**
 * A mention as it is written in a comment: `@handle`.
 *
 * The same pattern the server matches with (`models/comments.ts`), including the lookbehind that
 * keeps an email address and a path from being read as one -- `a@b.com` and `docs/@handle` mention
 * nobody.
 */
const MENTION_PATTERN = /(?<![\w@/])@([A-Za-z0-9_-]{3,32})/g

/** What a character becomes in the HTML this file writes around the markdown it rendered. */
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

function htmlEscape(value) {
  return `${value}`.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char])
}

/**
 * Turn the mentions in rendered HTML into links to the people they name.
 *
 * Run over the OUTPUT rather than the source, and only over its text: `@handle` inside a code span or
 * a fenced block is a piece of code somebody is quoting, not somebody being addressed, and rewriting
 * it would corrupt what they were quoting. So the scan skips anything between `<` and `>` (an
 * attribute could hold an `@`, in a `mailto:` link most obviously) and anything inside a `<code>`.
 *
 * A handle nobody holds is left as the text that was typed. A mention that linked to whoever happened
 * to take the handle later would be worse than no link at all.
 *
 * @param {string} html Rendered markdown
 * @param {Map<string, {id: string, name: string, handle: string}>} targets Handles, folded to lower
 *   case, that resolved to somebody
 */
function linkMentions(html, targets) {
  if (targets.size < 1) {
    return html
  }
  let out = ''
  let index = 0
  // -> One pass, splitting on the two things that must not be rewritten: tags, and code elements
  //    with everything between them
  const skip = /<code[\s>][\s\S]*?<\/code>|<[^>]*>/gi
  let match
  while ((match = skip.exec(html)) !== null) {
    out += replaceMentions(html.slice(index, match.index), targets)
    out += match[0]
    index = match.index + match[0].length
  }
  return out + replaceMentions(html.slice(index), targets)
}

function replaceMentions(text, targets) {
  return text.replace(MENTION_PATTERN, (written, handle) => {
    const target = targets.get(handle.toLowerCase())
    if (!target) {
      return written
    }
    return `<a class="comment-mention" href="/_user/${target.id}" title="${htmlEscape(target.name)}">@${htmlEscape(target.handle)}</a>`
  })
}

/**
 * Render one comment.
 *
 * @param {string} source Markdown as it was typed
 * @param {Array<{id: string, name: string, handle: string}>} mentions Handles that resolved to
 *   somebody, as the comments endpoint answered with them for this page. Absent, mentions are drawn
 *   as the plain text they were written as -- which is what the composer's preview does, since it has
 *   not asked the server about anything yet.
 * @returns {string} HTML, safe to hand to `v-html`: nothing in it came from the source unescaped
 */
export function renderComment(source, mentions = []) {
  const targets = new Map(mentions.map((m) => [m.handle.toLowerCase(), m]))
  return linkMentions(md.render(source ?? ''), targets)
}

export default renderComment
