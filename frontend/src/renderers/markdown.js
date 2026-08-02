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
import mdMultiTable from 'markdown-it-multimd-table'
import mdFootnote from 'markdown-it-footnote'
import mdMdc from 'markdown-it-mdc'
import mdUnderline from './modules/markdown-it-underline'
import mdImsize from './modules/markdown-it-imsize'
import mdGithubAlerts from './modules/github-alerts'
import twemoji from '@twemoji/api'

import hljs from 'highlight.js'

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

export class MarkdownRenderer {
  constructor(config = {}) {
    this.md = new MarkdownIt({
      html: config.allowHTML,
      breaks: config.lineBreaks,
      linkify: config.linkify,
      typography: config.typographer,
      quotes: quoteStyles[config.quotes] ?? quoteStyles.english,
      highlight(str, lang) {
        if (lang === 'diagram') {
          return `<pre class="diagram">${Buffer.from(str, 'base64').toString()}</pre>`
        } else if (['mermaid', 'plantuml'].includes(lang)) {
          /*
            Left as source, deliberately: a diagram is drawn by the block whose body it is —
            `block-diagram` for mermaid, `block-plantuml` for the other — and each reads the text out
            of this `pre`. A fence on its own outside a block keeps the panel the stylesheet gives it,
            which says "a diagram nobody has drawn" rather than pretending to be a code sample.
          */
          return `<pre class="codeblock-${lang}"><code>${escape(str)}</code></pre>`
        } else {
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
          const lineNums =
            lineCount > 1
              ? `<span aria-hidden="true" class="line-numbers-rows">${'<span></span>'.repeat(lineCount)}</span>`
              : ''
          // -> `lang` is escaped too: it is whatever the author typed after the backticks, and a quote
          //    in it would otherwise close the attribute and inject markup into the preview
          return `<pre class="codeblock hljs ${lineCount > 1 && 'line-numbers'}"><code class="language-${escape(lang ?? '')}">${highlighted.value}${lineNums}</code></pre>`
        }
      }
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

    if (config.underline) {
      this.md.use(mdUnderline)
    }

    if (config.mdmultiTable) {
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

    this.linesMap = []
    const injectLineNumbers = (tokens, idx, options, env, slf) => {
      let line
      if (tokens[idx].map && tokens[idx].level === 0) {
        line = tokens[idx].map[0] + 1
        tokens[idx].attrJoin('class', 'line')
        tokens[idx].attrSet('data-line', String(line))
        this.linesMap.push(line)
      }
      return slf.renderToken(tokens, idx, options, env, slf)
    }
    this.md.renderer.rules.paragraph_open = injectLineNumbers
    this.md.renderer.rules.heading_open = injectLineNumbers
    this.md.renderer.rules.blockquote_open = injectLineNumbers
  }

  render(src) {
    this.linesMap = []
    return this.md.render(src)
  }

  getClosestPreviewLine(line) {
    return this.linesMap.findLast((n) => n <= line)
  }
}
