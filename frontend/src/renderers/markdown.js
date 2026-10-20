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
import mdBlockquoteAuthor from './modules/blockquote-author'
import mdWikiLinks from './modules/markdown-it-wikilinks'
import mdInlineMath from './modules/markdown-it-inline-math'
import twemoji from '@twemoji/api'

// -> Relative, like this file's other in-repo imports: it is also reachable from the headless
//    renderer bundle, which is built on its own
import {
  MATH_ENGINES,
  codeBlock,
  fileSrc,
  isExternalHref,
  parseFenceAttributes,
  rewriteHtmlImages
} from './shared'

import { escape } from 'es-toolkit/string'

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
 * The marker that opens a task list item, as `markdown-it-task-lists` reads it.
 *
 * The same three spellings that plugin's own `startsWithTodoMarkdown` accepts, anchored for the same
 * reason it uses `indexOf(...) === 0`: a marker is only a marker at the start of the item's content.
 * The trailing space is part of it, which is what keeps a real `[x]{.cls}` span out of this.
 */
const TASK_LIST_MARKER = /^\[[ xX]\] /

/**
 * An emoji as the markup a page shows for it: a twemoji SVG served by this instance.
 *
 * Exported because the Visual editor draws emoji too, and a character rendered as text is whatever
 * font the author's machine happens to have — which is not what the page will show, and on a machine
 * with no emoji font is not anything at all. Going through this means the editor and the page cannot
 * disagree about it.
 *
 * Drawn from this instance, never from a CDN: the callback replaces twemoji's default `base` + size +
 * extension entirely, so the `src` is the whole path and nothing upstream is contacted for it.
 * `vite.config.js` puts the SVGs at `/_assets/svg/twemoji/` — copied into the build output, served out
 * of `node_modules` in dev — so the two have to agree on this path.
 *
 * The artwork comes from the same upstream project as this parser, at a pinned tag (see
 * `twemoji-assets` in `package.json`). They are separate dependencies, so the build checks that every
 * emoji a page can hold still resolves to a file — an emoji the parser knows and the asset set does
 * not is a broken image in a page.
 */
export function twemojiHtml(char) {
  return twemoji.parse(char, {
    callback(icon) {
      return `/_assets/svg/twemoji/${icon}.svg`
    }
  })
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
      .use(mdBlockquoteAuthor)

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

      The `[x]` of a task list item is the same collision with a nastier ending, because the task list
      plugin half-succeeds. It runs as a core rule after the inline is parsed, and decides an item is a
      task by reading the inline's raw `content` — which still says `[x] done`, so the checkbox is
      added. Removing the marker is the part that fails: `todoify` slices three characters off
      `children[1]`, expecting the text token the marker was in, and by then that token is the SPAN
      MDC opened, whose content is the empty string. Slicing nothing off nothing leaves the marker
      where it was, and every task item on every wiki rendered as a checkbox followed by a stray
      `<span>x</span>`.

      Wrapped rather than turned off, because the span is worth keeping and these are the only two
      readings of `[` it gets wrong. Both guards are as narrow as the thing they protect: `[^` is a
      footnote reference and nothing else, and a marker is the three characters `[ ]`, `[x]` or `[X]`
      followed by a space, at the very start of the inline — which is the only place the task list
      plugin looks for one. The trailing space is what keeps `[x]{.cls}` a span, since a marker cannot
      be followed by a brace.

      And it never answers a probe. Silent mode is only ever `skipToken`, which is how markdown-it
      measures a link's label -- stepping over everything in it -- and MDC's rule answered yes there
      while leaving `state.pos` where it was. A rule that claims a token has to move past it, and
      markdown-it throws when one does not, so any link whose text held brackets (`[[1]](https://…)`,
      the way citations are written) took the whole render down with `inline rule didn't increment
      state.pos`, freezing the editor's preview on the last good render. Moving past the span would
      not be the fix either: `parseLinkLabel` reads anything longer than one character that opens with
      `[` as a link inside the link, and refuses the outer one. A span is not a link, so the honest
      answer is no -- the bracket is then counted as plain text, as it is without MDC, and the label is
      tokenized for real afterwards, span and all.

      Reaching into `__rules__` is the only way to get hold of the original: markdown-it can replace a
      rule by name but has no way to read one back out.
    */
    const spanRule = this.md.inline.ruler.__rules__.find((rule) => rule.name === 'mdc_inline_span')
    const inlineSpan = spanRule.fn
    this.md.inline.ruler.at('mdc_inline_span', (state, silent) => {
      if (state.src[state.pos] === '[' && state.src[state.pos + 1] === '^') {
        return false
      }
      if (state.pos === 0 && TASK_LIST_MARKER.test(state.src)) {
        return false
      }
      if (silent) {
        return false
      }
      return inlineSpan(state, false)
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

    // -> MediaWiki's `[[Page Name]]` / `[[Page Name|text]]` -- see the module for where they point
    if (config.wikiLinks) {
      this.md.use(mdWikiLinks)
    }

    /*
      Inline math, `` $`x^2`$ `` -- see the module. Which block draws it is the site's choice, made
      once here rather than in every formula; `off` leaves the syntax unclaimed, so it reads as a
      dollar sign and a code span.
    */
    if (MATH_ENGINES.includes(config.inlineMath)) {
      this.md.use(mdInlineMath, { tag: `block-${config.inlineMath}` })
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

    // -> See `twemojiHtml`, which the Visual editor draws its emoji through as well
    this.md.renderer.rules.emoji = (token, idx) => twemojiHtml(token[idx].content)

    // --------------------------------
    // Inject line numbers for preview scroll sync
    // --------------------------------

    /*
      Every block that opens an element is stamped with the source lines it spans -- `data-line` the
      first, `data-line-end` the last -- which is all the editor's scroll sync knows about where the
      source and the preview line up (see `composables/previewScrollSync.js`).

      Every block, at every depth, rather than a chosen few. What the sync does between two stamped
      elements is interpolate, so the further apart they are the less it knows: a long list stamped only
      on its paragraphs had nothing to go on at all in a tight one, whose paragraphs are not drawn, and
      put the whole list at the line it started on. A list item, a table row, a definition and a tab
      panel each carry their own, and so does the END of each, which is what keeps a tall element -- an
      image, a diagram -- from smearing its height across the lines that come after it.

      A core rule at the end of the chain rather than a renderer rule per token type, because the plugins
      bring block types of their own and a list of them would only ever be missing one. An element whose
      renderer writes its own markup ignores the attributes, which costs nothing. A hidden token is
      skipped: it is parsed and never drawn, so its lines belong to the element around it.
    */
    this.md.core.ruler.push('source_lines', (state) => {
      for (const token of state.tokens) {
        if (token.nesting === 1 && token.map && !token.hidden) {
          token.attrSet('data-line', String(token.map[0] + 1))
          // -> `map` ends exclusively and from zero, which is the last line counted from one. Never
          //    before the first: a definition list's term comes out with an empty range
          token.attrSet('data-line-end', String(Math.max(token.map[1], token.map[0] + 1)))
        }
      }
    })

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

      The lines the fence spans are stamped into the markup rather than onto the token, since the token
      is not what renders it -- and a fence is a leaf, so the core rule above never reaches it. It is
      worth the string surgery for the case the preview's scroll sync exists for: a tabset whose panels
      each hold one long code sample -- per language, per platform -- is the commonest tabset there is,
      and exactly the one where the source has no anchor in the preview but this one.
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
      const line = token.map
        ? ` data-line="${token.map[0] + 1}" data-line-end="${token.map[1]}"`
        : ''
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
    /*
      The document's headings, in order, with the source line each starts on -- for an outline of the
      document beside the editor (the Contents pane, `EditorContentsPane.vue`). Collected from the token
      stream for the reason the tabsets below are: it is the parser's word on what a heading is, so a
      `#` in a code fence is not one and a setext heading is.

      The text is what a reader sees -- the inline children's text, without the markup around it --
      falling back to the raw source of the line for a heading made only of something with no text.
    */
    this.headings = []
    this.md.core.ruler.push('collect_headings', (state) => {
      this.headings = []
      for (const [index, token] of state.tokens.entries()) {
        if (token.type !== 'heading_open' || !token.map) {
          continue
        }
        const inline = state.tokens[index + 1]
        const text = (inline?.children ?? [])
          .map((child) => {
            if (child.type === 'text' || child.type === 'code_inline') {
              return child.content
            }
            return child.type === 'softbreak' ? ' ' : ''
          })
          .join('')
          .trim()
        this.headings.push({
          level: Number(token.tag.slice(1)),
          text: text || (inline?.content ?? '').trim(),
          line: token.map[0] + 1
        })
      }
    })

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
