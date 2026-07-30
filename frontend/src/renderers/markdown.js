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
import katex from 'katex'
import mdUnderline from './modules/markdown-it-underline'
import mdImsize from './modules/markdown-it-imsize'
import 'katex/dist/contrib/mhchem'
import twemoji from 'twemoji'
import plantuml from './modules/plantuml'
import kroki from './modules/kroki.mjs'
import katexHelper from './modules/katex'

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

    if (config.underline) {
      this.md.use(mdUnderline)
    }

    if (config.mdmultiTable) {
      this.md.use(mdMultiTable, { multiline: true, rowspan: true, headerless: true })
    }

    // --------------------------------
    // PLANTUML
    // --------------------------------

    if (config.plantuml) {
      plantuml.init(this.md, { server: config.plantumlServerUrl })
    }

    // --------------------------------
    // KROKI
    // --------------------------------

    if (config.kroki) {
      kroki.init(this.md, { server: config.krokiServerUrl })
    }

    // --------------------------------
    // KATEX
    // --------------------------------

    const macros = {}

    // TODO: Add mhchem (needs esm conversion)
    // Add \ce, \pu, and \tripledash to the KaTeX macros.
    // katex.__defineMacro('\\ce', function (context) {
    //   return chemParse(context.consumeArgs(1)[0], 'ce')
    // })
    // katex.__defineMacro('\\pu', function (context) {
    //   return chemParse(context.consumeArgs(1)[0], 'pu')
    // })

    //  Needed for \bond for the ~ forms
    //  Raise by 2.56mu, not 2mu. We're raising a hyphen-minus, U+002D, not
    //  a mathematical minus, U+2212. So we need that extra 0.56.
    katex.__defineMacro(
      '\\tripledash',
      '{\\vphantom{-}\\raisebox{2.56mu}{$\\mkern2mu' +
        '\\tiny\\text{-}\\mkern1mu\\text{-}\\mkern1mu\\text{-}\\mkern2mu$}}'
    )
    this.md.inline.ruler.after('escape', 'katex_inline', katexHelper.katexInline)
    this.md.renderer.rules.katex_inline = (tokens, idx) => {
      try {
        return katex.renderToString(tokens[idx].content, {
          displayMode: false,
          macros
        })
      } catch (err) {
        console.warn(err)
        return tokens[idx].content
      }
    }
    this.md.block.ruler.after('blockquote', 'katex_block', katexHelper.katexBlock, {
      alt: ['paragraph', 'reference', 'blockquote', 'list']
    })
    this.md.renderer.rules.katex_block = (tokens, idx) => {
      try {
        return (
          '<p>' +
          katex.renderToString(tokens[idx].content, {
            displayMode: true,
            macros
          }) +
          '</p>'
        )
      } catch (err) {
        console.warn(err)
        return tokens[idx].content
      }
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
