/**
 * What every page renderer in this app has to answer the same way, whatever syntax it parses.
 *
 * A page's HTML is produced in the author's browser and stored, so two pipelines writing the same
 * page differently is not a cosmetic problem -- it is two pages. These are the four places the
 * answer belongs to the WIKI rather than to a markup language:
 *
 * - where a picture actually loads from (`fileSrc`), which is a fact about how this server serves
 *   uploads and not about how a link was spelled;
 * - whether a link leaves the wiki (`isExternalHref`), which is a comparison against the page's own
 *   host and cannot be made in CSS;
 * - what a code block is drawn as (`codeBlock`), which carries the gutter, the highlighted rows and
 *   the `hljs` hooks the administrator's chosen theme is injected against, and the `pre.codeblock`
 *   that `helpers/renderedContent.js` hangs a copy button on;
 * - how a fence's extra attributes are read (`parseFenceAttributes`), since the AsciiDoc pipeline
 *   spells the same three requests as block attributes and has to end up with the same object.
 *
 * Kept apart from `markdown.js` so that reaching for them does not reach for markdown-it and its
 * fifteen plugins: the AsciiDoc renderer is a lazy chunk of its own and shares only this.
 */
import hljs from 'highlight.js'

import { escape } from 'es-toolkit/string'

// -> Relative, like the renderers' other in-repo imports: this module is reachable from the headless
//    renderer bundle, which is built on its own
import { isServerPath } from '../helpers/serverPaths'
import { FILES_PREFIX } from '../helpers/assets'

/**
 * Whether a link leaves this wiki.
 *
 * Resolved against the page's own address, so a relative path, an absolute one and a protocol-relative
 * URL are all judged the same way -- by the host they end up on. `mailto:`, `tel:` and the rest are not
 * pages at all, and are left unmarked: they announce themselves by what they are.
 *
 * With no document to resolve against -- a render outside a browser -- only an absolute URL can be
 * judged, and it is judged external; a relative one fails to parse and comes back internal.
 */
export function isExternalHref(href) {
  if (!href) {
    return false
  }
  const here = globalThis.location?.href
  try {
    const url = new URL(href, here)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return false
    }
    return here ? url.origin !== new URL(here).origin : true
  } catch {
    return false
  }
}

/**
 * Where an image in a page should actually load from.
 *
 * A page's source addresses a picture the way a file sitting next to it would -- `photo.png`,
 * `img/photo.png`, `/media/photo.png` -- which is what the same markdown means in a repository, and
 * what an author who wrote it elsewhere expects it to mean here. None of those is a URL this server
 * answers: uploaded files live under `/_files/`. So the resolution happens at render time and the
 * source is left holding the path that was written, which is what keeps the file readable on GitHub.
 *
 * Relative is relative to the page's FOLDER, as it would be to a file's directory in a repository, so
 * a picture beside the page is found from a page at any depth. A path that starts at the root means
 * the site root.
 *
 * Only images. A relative LINK is a link to another page and means exactly what it says, so the same
 * treatment would break it -- an image is the one thing that is always a file.
 *
 * Left alone: anything carrying a scheme of its own (`http:`, `data:`, and the `blob:` a pending
 * upload sits behind until the save that uploads it), a protocol-relative URL, a bare fragment, and a
 * path the server already owns -- `/_files/` included, so rendering a render changes nothing.
 *
 * @param {string} src The source as written.
 * @param {string} pagePath Path of the page being rendered, without a leading slash. The site root
 *                          when it is not known, which is where a render with no page behind it --
 *                          a review, a history entry -- resolves from.
 * @returns {string} The source to render with.
 */
export function fileSrc(src, pagePath = '') {
  const value = (src ?? '').trim()
  if (
    !value ||
    value.startsWith('#') ||
    value.startsWith('//') ||
    /^[a-z][a-z\d+.-]*:/i.test(value)
  ) {
    return src
  }
  if (isServerPath(value)) {
    return src
  }
  /*
    Resolved with `URL` so that `..`, `.`, a query and a fragment all behave the way they do
    everywhere else, and so that a space in a file name comes out encoded. The origin is a
    placeholder that never survives -- only the path it works out does.
  */
  const folder = pagePath.split('/').slice(0, -1).join('/')
  try {
    const url = new URL(value, `http://page.invalid/${folder ? `${folder}/` : ''}`)
    return `${FILES_PREFIX}${url.pathname.replace(/^\/+/, '')}${url.search}${url.hash}`
  } catch {
    return src
  }
}

/**
 * An `<img>` written as HTML rather than as markdown, matched on its `src` and nothing else.
 *
 * The whitespace before `src` is what keeps `data-src` -- and any other attribute ending in those
 * three characters -- out of it, since a word boundary alone sits happily after the hyphen.
 */
const HTML_IMAGE_SRC = /(<img\b[^>]*?\ssrc\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi

/**
 * The same resolution, for the images an author wrote as HTML.
 *
 * Raw HTML reaches the renderer as text -- markdown-it does not parse it -- so this is a pass over
 * that text rather than over a token's attributes. It rewrites the `src` of an `img` tag and touches
 * nothing else, and every value it produces has been through `URL`, so quoting it is safe.
 */
export function rewriteHtmlImages(html, pagePath) {
  return html.replace(HTML_IMAGE_SRC, (match, before, quoted, singleQuoted, bare) => {
    const value = quoted ?? singleQuoted ?? bare
    const resolved = fileSrc(value, pagePath)
    return resolved === value ? match : `${before}"${resolved}"`
  })
}

/**
 * Everything a fence may say about itself beyond its language.
 *
 * ```yaml title="Some title here" linesStart="3" linesHighlight="1,3,5-8"
 *
 * markdown-it takes the first word of the info string as the language name and leaves the rest of the
 * line alone, so this is a parse of that remainder and of nothing else. A value may be quoted with
 * either quote or left bare, because bare is what anybody writes for a number; a key with no value is
 * not matched at all, since none of the three means anything without one. A quoted value may hold the
 * quote that delimits it if it is escaped -- `title="Say \\"hi\\""` -- which is why the backslash is
 * consumed here rather than left for `unescapeAll` to find after the value has already been cut short.
 *
 * Keys are folded to lower case. The syntax is documented in camel case and reads better that way, but
 * `linestart` is the same request typed by somebody who did not look closely, and there is nothing to
 * be gained by refusing it.
 */
const FENCE_ATTRIBUTE =
  /([a-z][\w-]*)\s*=\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s"']+))/gi

export function parseFenceAttributes(source, unescape = (value) => value) {
  const attributes = {}
  for (const match of source.matchAll(FENCE_ATTRIBUTE)) {
    attributes[match[1].toLowerCase()] = unescape(match[2] ?? match[3] ?? match[4])
  }
  return attributes
}

/** One entry of a `linesHighlight` list: a single line, or a range written with a hyphen. */
const LINE_RANGE = /^(\d+)(?:\s*-\s*(\d+))?$/

/**
 * The lines a `linesHighlight` value names, kept as the ranges it lists rather than expanded into the
 * set of numbers in them -- `1-40000000` is a plausible slip of the hand and a set built from it is a
 * hung tab. Nothing needs the numbers themselves; every caller only ever asks whether one line is in.
 *
 * An entry that is neither a number nor a range is dropped rather than failing the fence. The whole
 * feature is decoration over a block that renders perfectly well without it, and the render this runs
 * in is the editor's preview -- one that throws is one the editor saves as an empty page.
 *
 * A range written backwards (`8-5`) is read as the range it plainly means.
 */
function parseLineRanges(value) {
  const ranges = []
  for (const entry of (value ?? '').split(',')) {
    const match = LINE_RANGE.exec(entry.trim())
    if (!match) {
      continue
    }
    const from = Number(match[1])
    const to = match[2] === undefined ? from : Number(match[2])
    ranges.push([Math.min(from, to), Math.max(from, to)])
  }
  return ranges
}

/** Whether `line` falls in any of them. */
function inRanges(ranges, line) {
  return ranges.some(([from, to]) => line >= from && line <= to)
}

/**
 * The number the gutter counts from, which is also what `linesHighlight` is written against: a snippet
 * lifted out of a file at line 30 shows 30 against its first row, and the line an author wants marked
 * is the one they can read off the gutter rather than one they have to count to.
 *
 * Anything that is not a whole non-negative number falls back to 1, the number a gutter counts from
 * when nobody said otherwise.
 */
function parseLineStart(value) {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 1
}

/**
 * The row layer of a code block: one empty `<span>` per line of code.
 *
 * Two things are drawn off these rows, and neither can be drawn off the code itself. The line numbers
 * come from a counter, so the digits are never part of the text and a copied selection stays clean.
 * And the wash behind a highlighted line is the row's own background: highlighting a line by wrapping
 * it would mean splitting the highlighted HTML on its newlines and re-balancing whatever hljs left
 * open across them -- a multi-line comment or string is one span -- where a row already lands on its
 * line by geometry alone.
 *
 * Drawn for a block of more than one line, which is where a gutter is worth having, and for a
 * single-line block that asked for a highlight. `aria-hidden`, because a screen reader is reading the
 * code and these rows say nothing about it.
 */
function lineRows(lineCount, lineStart, highlights) {
  const rows = []
  for (let index = 0; index < lineCount; index++) {
    rows.push(
      inRanges(highlights, lineStart + index)
        ? '<span class="is-highlighted"></span>'
        : '<span></span>'
    )
  }
  return `<span aria-hidden="true" class="line-numbers-rows">${rows.join('')}</span>`
}

/**
 * One fence, as the markup it is drawn as -- always rooted at a `<pre>`, whatever it holds.
 *
 * @param {string} str The code, as the author wrote it.
 * @param {string} lang The first word of the info string.
 * @param {object} attributes The rest of it, parsed -- see `parseFenceAttributes`. Ignored by the
 *                            diagram branch, which is a source for something else to draw and has
 *                            no gutter, no title bar and no lines to mark.
 */
export function codeBlock(str, lang, attributes) {
  if (['kroki', 'mermaid', 'plantuml'].includes(lang)) {
    /*
      Left as source, deliberately: a diagram is drawn by the block whose body it is —
      `block-diagram` for mermaid, `block-plantuml` and `block-kroki` for the others — and each
      reads the text out of this `pre`. A fence on its own outside a block keeps the panel the
      stylesheet gives it, which says "a diagram nobody has drawn" rather than pretending to be
      a code sample.
    */
    return `<pre class="codeblock-${lang}"><code>${escape(str)}</code></pre>`
  }

  /*
    `getLanguage` first, because `hljs.highlight` THROWS on a language it does not know --
    `ignoreIllegals` only forgives illegal syntax within a language it does. markdown-it takes
    the first word of a fence's info string as the language name, so a fence whose code starts
    on the opening line (```   <!DOCTYPE rfc [) asks for a language called `<!DOCTYPE`, and the
    throw took the entire render with it: an empty preview, and -- since the editor patches the
    store with the result -- an empty render saved over the stored HTML.

    Unknown language therefore falls back to plain code, and the fallback ESCAPES: `str` is the
    author's raw source, and the unhighlighted branch used to interpolate it into the markup as
    it stood. hljs escapes what it emits, so this only ever affected the unhighlighted path.
  */
  const highlighted =
    lang && hljs.getLanguage(lang)
      ? hljs.highlight(str, { language: lang, ignoreIllegals: true })
      : { value: escape(str) }
  // -> `match` is null, not empty, when the code is a single line with no trailing newline
  const lineCount = (highlighted.value.match(/\n/g) ?? []).length

  const lineStart = parseLineStart(attributes.linesstart)
  const highlights = parseLineRanges(attributes.lineshighlight)
  /*
    The gutter is for a block worth numbering; a one-line block is its own line number. A highlight
    still needs its row, so the two are separate questions -- the class is what draws the digits, the
    layer is what the wash is painted on.
  */
  const numbered = lineCount > 1
  const rows =
    numbered || highlights.length > 0 ? lineRows(Math.max(lineCount, 1), lineStart, highlights) : ''

  /*
    Where the counter starts, as the value it is reset to -- one below the first line, since every row
    increments before it draws. Left off entirely at the default, so that a block nobody has renumbered
    carries no style attribute at all.
  */
  const numbering = lineStart === 1 ? '' : ` style="--code-line-start: ${lineStart - 1}"`
  // -> `lang` is escaped too: it is whatever the author typed after the backticks, and a quote
  //    in it would otherwise close the attribute and inject markup into the preview
  return `<pre class="codeblock hljs${numbered ? ' line-numbers' : ''}"${numbering}><code class="language-${escape(lang)}">${highlighted.value}${rows}</code></pre>`
}
