import MarkdownIt from 'markdown-it'
import mdAttrs from 'markdown-it-attrs'
import mdDecorate from 'markdown-it-decorate'
import { full as mdEmoji } from 'markdown-it-emoji'
import mdTaskLists from 'markdown-it-task-lists'
import mdExpandTabs from 'markdown-it-expand-tabs'
import mdAbbr from 'markdown-it-abbr'
import mdSup from 'markdown-it-sup'
import mdSub from 'markdown-it-sub'
import mdMark from 'markdown-it-mark'
import mdDeflist from 'markdown-it-deflist'
import mdMultiTable from 'markdown-it-multimd-table'
import mdFootnote from 'markdown-it-footnote'
import mdMdc from 'markdown-it-mdc'
import mdUnderline from './modules/markdown-it-underline'
import mdImsize from './modules/markdown-it-imsize'
import mdGithubAlerts from './modules/github-alerts'
import twemoji from '@twemoji/api'

import hljs from 'highlight.js'

import { escape } from 'es-toolkit/string'

// -> Relative, like this file's other in-repo imports: it is also the entry point of the headless
//    renderer bundle, which is built on its own
import { isServerPath } from '../helpers/serverPaths'
import { FILES_PREFIX } from '../helpers/assets'

const quoteStyles = {
  chinese: '””‘’',
  english: '“”‘’',
  french: ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'],
  german: '„“‚‘',
  greek: '«»‘’',
  japanese: '「」「」',
  hungarian: '„”’’',
  polish: '„”‚‘',
  portuguese: '«»‘’',
  russian: '«»„“',
  spanish: '«»‘’',
  swedish: '””’’'
}

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
function isExternalHref(href) {
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
function fileSrc(src, pagePath = '') {
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
function rewriteHtmlImages(html, pagePath) {
  return html.replace(HTML_IMAGE_SRC, (match, before, quoted, singleQuoted, bare) => {
    const value = quoted ?? singleQuoted ?? bare
    const resolved = fileSrc(value, pagePath)
    return resolved === value ? match : `${before}"${resolved}"`
  })
}

/**
 * An `<iconify-icon>` written the way a Vue component is, `<iconify-icon icon="mdi:home" />`.
 *
 * The lookahead rather than a `\b`: a hyphen ends a word, so a boundary alone also matches the start
 * of `<iconify-icon-something />` and would close it with the wrong tag.
 */
const SELF_CLOSED_ICON = /<iconify-icon(?![\w-])([^>]*?)\s*\/>/gi

/**
 * Give a self-closed icon the closing tag it actually needs.
 *
 * `/>` closes nothing in HTML outside the void elements, so the parser hands the icon the rest of the
 * paragraph as children -- and `iconify-icon` draws a shadow root with no slot in it, so that text
 * lands on the page invisible. The form is the one anybody writes, having seen it in every framework
 * for twenty years, and it is unambiguous about what was meant: an icon has no content.
 *
 * Done here, over the author's own HTML, rather than over the finished render, so that a `<iconify-icon
 * />` shown INSIDE a code block stays exactly as it was written -- that text is escaped by the time it
 * is rendered and is not raw HTML at all. `models/rendering.ts` lifts out anything that got nested
 * anyway, since a render can also arrive from something that is not this renderer.
 */
function closeIconTags(html) {
  return html.replace(SELF_CLOSED_ICON, '<iconify-icon$1></iconify-icon>')
}

/**
 * An icon written the way an emoji is: `:mdi:arrow-vertical-lock:`.
 *
 * The inner colon is what tells the two apart, and it is a reliable tell in both directions: an
 * Iconify reference is always `prefix:name` and an emoji shortcode never holds a colon. So the two
 * syntaxes can share the delimiter without either having to know about the other -- `:smile:` has
 * nothing here to match, and this rule runs while the inline is tokenized, well before the emoji
 * plugin's core rule ever looks at the text.
 *
 * Sticky rather than anchored, so it is matched at the cursor without slicing the source at every
 * colon in the document.
 *
 * The prefix must begin with a letter, which every Iconify set does. Without that, `10:30:45:` in a
 * line of prose is an icon reference as far as this is concerned.
 */
const ICON_SHORTCODE = /:([a-z][a-z\d]*(?:-[a-z\d]+)*):([a-z\d]+(?:[-.][a-z\d]+)*):/y

/** The inline rule behind it. `state.pos` is at a `:` for any of this to be worth trying. */
function iconShortcode(state, silent) {
  if (state.src.charCodeAt(state.pos) !== 0x3a /* : */) {
    return false
  }
  ICON_SHORTCODE.lastIndex = state.pos
  const match = ICON_SHORTCODE.exec(state.src)
  // -> `posMax` is the end of what is being tokenized, which inside a link label is not the end of
  //    the line: a match that runs past it belongs to the text after, not to this
  if (!match || state.pos + match[0].length > state.posMax) {
    return false
  }
  if (!silent) {
    const token = state.push('iconify_icon', 'iconify-icon', 0)
    token.markup = match[0]
    token.content = `${match[1]}:${match[2]}`
  }
  state.pos += match[0].length
  return true
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

function parseFenceAttributes(source, unescape = (value) => value) {
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
 *                            diagram branches, which are a source for something else to draw and have
 *                            no gutter, no title bar and no lines to mark.
 */
function codeBlock(str, lang, attributes) {
  if (lang === 'diagram') {
    return `<pre class="diagram">${Buffer.from(str, 'base64').toString()}</pre>`
  }
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

export class MarkdownRenderer {
  constructor(config = {}) {
    this.md = new MarkdownIt({
      html: config.allowHTML,
      breaks: config.lineBreaks,
      linkify: config.linkify,
      typography: config.typographer,
      quotes: quoteStyles[config.quotes] ?? quoteStyles.english
    })
      /*
        MDC's INLINE component syntax is off, and deliberately: `:name` is how it writes one, which is
        also how markdown writes an emoji, and MDC parses first. With it on, `:rocket:` came out as
        `<rocket>:` and no emoji shortcode in any page ever rendered — while this file goes to the
        trouble of drawing them as twemoji SVGs, and the editor has a picker for them.

        Everything else MDC brings is untouched: block components (`::note`), inline props and inline
        spans. Turning this back on means giving up emoji shortcodes again.
      */
      .use(mdMdc, { syntax: { inlineComponent: false } })
      .use(mdAttrs, {
        allowedAttributes: ['id', 'class', 'target']
      })
      .use(mdDecorate)
      .use(mdEmoji)
      .use(mdTaskLists, { label: false, labelAfter: false })
      .use(mdExpandTabs, { tabWidth: config.tabWidth })
      .use(mdAbbr)
      .use(mdSup)
      .use(mdSub)
      .use(mdMark)
      .use(mdDeflist)
      .use(mdFootnote)
      .use(mdImsize)
      .use(mdGithubAlerts)

    /*
      MDC's slot syntax, off for the same reason as inline components: it takes a line the author
      meant as something else.

      Inside a block body it claims every line starting with `#` whose second character is not a
      space -- which is every markdown heading from `##` down. `::block-tabs` with a `### Step` in it
      threw `Invalid block params: # Step` out of the renderer, leaving the editor's preview frozen on
      the last good render with only a console error to say why, and a save then storing that stale
      HTML. Nothing is lost by turning it off: a slot renders as `<template #name>`, and `template` is
      not a tag a page may carry, so the server stripped every one of them anyway.
    */
    this.md.block.ruler.disable('mdc_block_slots')

    /*
      MDC's inline span, `[text]{.class}`, claims every `[` it meets — including the `[^1]` of a
      footnote reference, which came out as `<span>^1</span>`. The note itself then vanished too,
      since a definition nothing refers to is dropped. Rule order settles it whatever order the
      plugins are added in: the span rule is registered before `link`, the footnote rule after
      `image`, so the span always gets there first.

      Wrapped rather than turned off, because the span is worth keeping and the two are only ever
      confusable at `[^` — which is a footnote reference and nothing else. Reaching into `__rules__`
      is the only way to get hold of the original: markdown-it can replace a rule by name but has no
      way to read one back out.
    */
    const spanRule = this.md.inline.ruler.__rules__.find((rule) => rule.name === 'mdc_inline_span')
    const inlineSpan = spanRule.fn
    this.md.inline.ruler.at('mdc_inline_span', (state, silent) => {
      if (state.src[state.pos] === '[' && state.src[state.pos + 1] === '^') {
        return false
      }
      return inlineSpan(state, silent)
    })

    /*
      MDC's inline props, `{.class}`, and `markdown-it-attrs` both claim `{`, and MDC gets there first
      — it runs while the inline is being parsed, `markdown-it-attrs` in a core rule afterwards, so
      whatever MDC takes is already gone by the time the braces would have become attributes.

      That is what made `{.is-warning}` on the line under a blockquote do nothing at all: the braces
      were eaten and the class never reached the element. The same collision crashed the render
      outright — `Cannot read properties of undefined (reading 'tag')` out of MDC's own renderer —
      when the braces opened an inline, since the props it parsed then had no node to attach to. In
      the editor that reads as the preview freezing on the last good render, and a save then storing
      that stale HTML.

      The two are told apart by what comes before the brace, which is also what each one means by it:
      MDC's props decorate the thing they are stuck to (`[text]{.cls}`, `![img](…){.cls}`), while a
      brace opening a line, or standing off behind a space, is `markdown-it-attrs` addressing the
      block as a whole. So MDC keeps every brace that abuts a preceding character and lets the rest
      fall through to the core rule.
    */
    const propsRule = this.md.inline.ruler.__rules__.find(
      (rule) => rule.name === 'mdc_inline_props'
    )
    const inlineProps = propsRule.fn
    this.md.inline.ruler.at('mdc_inline_props', (state, silent) => {
      const preceding = state.src[state.pos - 1]
      if (preceding === undefined || /\s/.test(preceding)) {
        return false
      }
      return inlineProps(state, silent)
    })

    /*
      Icons written as shortcodes, `:mdi:home:`.

      Registered ahead of every other inline rule so that the whole reference is claimed in one go.
      Nothing else wants it -- MDC's inline component syntax, the only other rule that would take a
      colon, is off above -- but the alternative is the emoji plugin's core rule, which runs over the
      TEXT of a token that by then has already been split around the colons.
    */
    this.md.inline.ruler.before('text', 'iconify_icon', iconShortcode)
    this.md.renderer.rules.iconify_icon = (tokens, idx) =>
      `<iconify-icon icon="${tokens[idx].content}"></iconify-icon>`

    if (config.underline) {
      this.md.use(mdUnderline)
    }

    /*
      MultiMarkdown tables: multi-line cells, `^^` rowspans, and a table with no header row.

      `multimdTable` is the name the setting has everywhere else -- `base.yml`, `models/sites.ts`, the
      editor's config overlay -- and this read it as `mdmultiTable`, so the plugin was never installed
      and none of those three features has ever worked.

      The shim is what makes fixing that safe. `markdown-it-multimd-table` merges its options with
      `md.utils.assign`, which markdown-it dropped in 14; on 15 the `use()` call throws
      `md.utils.assign is not a function`, out of the CONSTRUCTOR -- so with the name corrected and
      nothing else, every render in the app would have died instead. 4.2.3 is the last release of the
      plugin (Aug 2023) and there is no fixed version to move to.

      `md.utils` is one object shared by every markdown-it instance, so this restores the helper
      process-wide rather than for this renderer. That is as narrow as it can be made and it is benign:
      the removed helper WAS this, minus a guard against non-object sources that the one call site
      cannot hit.
    */
    if (config.multimdTable) {
      this.md.utils.assign ??= Object.assign
      this.md.use(mdMultiTable, { multiline: true, rowspan: true, headerless: true })
    }

    // --------------------------------
    // LINK DESTINATIONS
    // --------------------------------

    /*
      Where a link goes is decided here, at render time, and recorded as a class -- `is-external-link`
      -- for the stylesheet to mark. It cannot be decided in CSS: a selector can match on the shape of
      an href but not compare its host with the wiki's own, which is the whole question.

      The class survives being stored: `models/rendering.ts` keeps `class` on every element.
    */
    this.md.renderer.rules.link_open = (tokens, idx, options, env, slf) => {
      if (isExternalHref(tokens[idx].attrGet('href'))) {
        tokens[idx].attrJoin('class', 'is-external-link')
      }
      return slf.renderToken(tokens, idx, options, env, slf)
    }

    // --------------------------------
    // RESOLVE IMAGE SOURCES
    // --------------------------------

    /*
      Where a picture loads from -- see `fileSrc` for what is rewritten and why the source keeps what
      the author wrote.

      Wrapped around whichever rule is in place rather than replacing it: the default one is what turns
      an image token's children into its `alt` text, and `markdown-it-imsize` has already put the size
      it parsed on the same token.
    */
    const renderImage =
      this.md.renderer.rules.image ??
      ((tokens, idx, options, env, slf) => slf.renderToken(tokens, idx, options, env, slf))
    this.md.renderer.rules.image = (tokens, idx, options, env, slf) => {
      const src = tokens[idx].attrGet('src')
      if (src) {
        tokens[idx].attrSet('src', fileSrc(src, env?.pagePath))
      }
      return renderImage(tokens, idx, options, env, slf)
    }

    /*
      And the same for an `<img>` the author wrote as HTML, which never becomes a token to hold an
      attribute -- so it is the rendered text that is rewritten, after whatever rule produced it.
      Raw HTML is also where a self-closed `<iconify-icon />` turns up, and it is fixed in the same
      pass for the same reason: this is the only point at which the author's own markup is still
      distinguishable from the markup the renderer produced.
    */
    const passthrough = (tokens, idx) => tokens[idx].content
    for (const rule of ['html_block', 'html_inline']) {
      const renderHtml = this.md.renderer.rules[rule] ?? passthrough
      this.md.renderer.rules[rule] = (tokens, idx, options, env, slf) =>
        closeIconTags(rewriteHtmlImages(renderHtml(tokens, idx, options, env, slf), env?.pagePath))
    }

    // --------------------------------
    // TWEMOJI
    // --------------------------------

    /*
      Drawn from this instance, never from a CDN: the callback replaces twemoji's default `base` +
      size + extension entirely, so the `src` is the whole path and nothing upstream is contacted for
      it. `vite.config.js` puts the SVGs at `/_assets/svg/twemoji/` — copied into the build output,
      served out of `node_modules` in dev — so the two have to agree on this path.

      The artwork comes from the same upstream project as this parser, at a pinned tag (see
      `twemoji-assets` in `package.json`). They are separate dependencies, so the build checks that
      every emoji a page can hold still resolves to a file — an emoji the parser knows and the asset
      set does not is a broken image in a page.
    */
    this.md.renderer.rules.emoji = (token, idx) => {
      return twemoji.parse(token[idx].content, {
        callback(icon, opts) {
          return `/_assets/svg/twemoji/${icon}.svg`
        }
      })
    }

    // --------------------------------
    // Inject line numbers for preview scroll sync
    // --------------------------------

    /*
      Stamped at every depth, not only on the tokens sitting at the top level of the document. The
      editor finds the line the caret is on by this attribute and nothing else, so a token without one
      is a line the preview cannot be scrolled to -- and everything written inside a block was such a
      line, `::block-tab` panels most of all. What that looked like: the nearest line the editor could
      find for a caret inside a panel was the last paragraph ABOVE the whole tabset, so the preview
      scrolled up out of the panel being written in, however long its content was.

      A hidden token is skipped. A tight list's paragraphs are parsed and then not rendered, and a
      single-paragraph block body is unwrapped the same way, so stamping one would leave the editor
      looking for an element that was never drawn -- worse than not knowing the line, since it would
      stop looking for something it could have scrolled to instead.
    */
    const injectLineNumbers = (tokens, idx, options, env, slf) => {
      const token = tokens[idx]
      if (token.map && !token.hidden) {
        token.attrJoin('class', 'line')
        token.attrSet('data-line', String(token.map[0] + 1))
      }
      return slf.renderToken(tokens, idx, options, env, slf)
    }
    this.md.renderer.rules.paragraph_open = injectLineNumbers
    this.md.renderer.rules.heading_open = injectLineNumbers
    this.md.renderer.rules.blockquote_open = injectLineNumbers

    /*
      CODE BLOCKS
      -----------

      Rendered here rather than through markdown-it's `highlight` option, which is where the hljs call
      used to live, because the whole of the markup a fence produces is decided by its info string and
      `highlight` is handed only the language off the front of it. It also cannot produce a wrapper: the
      default fence rule takes the return value whole ONLY if it starts with `<pre`, and wraps it in a
      `<pre><code>` of its own otherwise -- so the title bar, which has to sit outside the scrolling
      panel, has nowhere to go from in there.

      Nothing is lost by owning the rule instead. The token's own attributes were already going
      unrendered for exactly the same reason, so `markdown-it-attrs` on a fence has never done anything.

      Three optional attributes, after the language:

          ```yaml title="Some title here" linesStart="3" linesHighlight="1,3,5-8"

      `title` becomes a header bar above the block; `linesStart` renumbers the gutter; `linesHighlight`
      washes the rows it names. See `codeBlock` for the last two and `parseFenceAttributes` for the
      shape of all three. A diagram fence ignores them -- it is a source for something else to draw.

      The line the fence sits on is stamped into the markup rather than onto the token, since the token
      is not what renders it. It is worth the string surgery for the case the preview's scroll sync
      exists for: a tabset whose panels each hold one long code sample -- per language, per platform --
      is the commonest tabset there is, and exactly the one where the caret has no anchor of its own.
      The attribute only, without the `line` class the tokens above join, because it would have to go on
      a tag that already carries a class and two `class` attributes on one tag is not markup.
    */
    this.md.renderer.rules.fence = (tokens, idx) => {
      const token = tokens[idx]
      const info = (token.info ?? '').trim()
      const boundary = info.search(/\s/)
      /*
        Unescaped value by value rather than over the info string as a whole -- which is what the
        default rule does, and what it can afford to do because it never looks inside. The string is
        source text, so `\\"` in it is an author writing a quote, and unescaping first would have that
        quote close the attribute it was written into: `title="Say \\"hi\\""` came out as `Say`.
      */
      const unescape = (value) => this.md.utils.unescapeAll(value)
      const lang = unescape(boundary < 0 ? info : info.slice(0, boundary))
      const attributes = parseFenceAttributes(
        boundary < 0 ? '' : info.slice(boundary + 1),
        unescape
      )

      const html = codeBlock(token.content, lang, attributes)
      const line = token.map ? ` data-line="${token.map[0] + 1}"` : ''
      const title = (attributes.title ?? '').trim()

      /*
        The bar is a sibling of the `<pre>` and not a child of it, because the panel is the thing that
        scrolls: a header inside it would slide sideways with the code and be indented by the gutter's
        padding. So a titled block is a box holding both, and the box is what carries the border, the
        radius and the line the editor scrolls to.

        `hljs` on that box as well as on the panel, which is what keeps the two the same colour: the code
        theme an administrator picks is injected as bare `.hljs` rules setting a background and an ink,
        so the box has to be able to take them or the bar would stay light over a dark panel.
      */
      if (title) {
        return `<div class="codeblock-titled hljs"${line}><div class="codeblock-title">${escape(title)}</div>${html}</div>\n`
      }
      // -> Every branch of `codeBlock` opens with `<pre`
      return `${html.replace(/^<pre/, `<pre${line}`)}\n`
    }

    // --------------------------------
    // Where the tabsets are, for the editor's preview
    // --------------------------------

    /*
      Every tabset in the document, in order, as the source line range of each of its panels.

      This is for the editor: a `block-tabs` in the preview keeps which panel is open in its own state,
      and the preview is rebuilt from scratch on every keystroke — so without this, writing inside the
      second panel of a tabset threw the author back to the first one, and no amount of preserving state
      across the rebuild would say WHICH panel they are working in.

      Read from the token stream rather than by scanning the source for `::block-tab`, so it is the
      parser's opinion of where each panel begins and ends, and it cannot drift from the markup the same
      parse produced. Only line numbers are kept: everything else about a panel is already in the render.
    */
    this.tabsMap = []
    this.md.core.ruler.push('collect_tabsets', (state) => {
      this.tabsMap = []
      // -> A stack, because a tabset may sit inside another one; a panel belongs to the innermost
      const open = []
      for (const token of state.tokens) {
        if (token.tag === 'block-tabs' && token.type === 'mdc_block_open') {
          const tabset = []
          this.tabsMap.push(tabset)
          open.push(tabset)
        } else if (token.tag === 'block-tabs' && token.type === 'mdc_block_close') {
          open.pop()
        } else if (
          token.tag === 'block-tab' &&
          token.type === 'mdc_block_open' &&
          token.map &&
          open.length > 0
        ) {
          open.at(-1).push(token.map)
        }
      }
    })
  }

  /**
   * @param {string} src Markdown source.
   * @param {string} [pagePath] Path of the page this source belongs to, without a leading slash. What
   *                            a relative image resolves against -- see `fileSrc`.
   */
  render(src, { pagePath = '' } = {}) {
    // -> A fresh env every time, whatever the caller passed: markdown-it keeps per-render state in it
    //    (footnotes and references), and one shared between renders would carry the last one's
    return this.md.render(src, { pagePath })
  }

  /**
   * Which tabset panels a source line is inside, as the pairs of indices that find them in the render.
   *
   * Every panel that contains the line, outermost first, rather than only the one it is written in: a
   * tabset nested in another one is drawn inside a panel, and opening the inner panel while the panel
   * holding it stays closed reveals nothing at all. The last entry is therefore the panel the line is
   * actually in, and the ones before it are what has to be opened for it to be on the page.
   *
   * Ordered by construction: `tabsMap` is built in document order, so a tabset that encloses another
   * is always the earlier of the two.
   *
   * @param {number} line A 1-based editor line, as Monaco counts them.
   * @returns {Array<{tabset: number, tab: number}>} Indices among the document's tabsets and each
   *          tabset's panels, outermost first. Empty when the line is not inside one.
   */
  getTabsAtLine(line) {
    const found = []
    for (const [tabset, tabs] of this.tabsMap.entries()) {
      for (const [tab, map] of tabs.entries()) {
        /*
          `map` is 0-based and ends one past the panel's last line of content, which is exactly the line
          its `::` sits on -- so the end is inclusive here, and a caret resting on the marker that closes
          a panel still counts as being in it.
        */
        if (line - 1 >= map[0] && line - 1 <= map[1]) {
          found.push({ tabset, tab })
        }
      }
    }
    return found
  }
}
