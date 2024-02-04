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
import mdImsize from './modules/markdown-it-imsize.mjs'
import mdUnderline from './modules/markdown-it-underline.mjs'
// import 'katex/dist/contrib/mhchem'
import twemoji from 'twemoji'
import plantuml from './modules/plantuml.mjs'
import kroki from './modules/kroki.mjs'
import katexHelper from './modules/katex.mjs'

import hljs from 'highlight.js'

import { escape, times } from 'lodash-es'

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

export async function render (input, config) {
  const md = new MarkdownIt({
    html: config.allowHTML,
    breaks: config.lineBreaks,
    linkify: config.linkify,
    typography: config.typographer,
    quotes: quoteStyles[config.quotes] ?? quoteStyles.english,
    highlight (str, lang) {
      if (lang === 'diagram') {
        return `<pre class="diagram">${Buffer.from(str, 'base64').toString()}</pre>`
      } else if (['mermaid', 'plantuml'].includes(lang)) {
        return `<pre class="codeblock-${lang}"><code>${escape(str)}</code></pre>`
      } else {
        const highlighted = lang ? hljs.highlight(str, { language: lang, ignoreIllegals: true }) : { value: str }
        const lineCount = highlighted.value.match(/\n/g).length
        const lineNums = lineCount > 1 ? `<span aria-hidden="true" class="line-numbers-rows">${times(lineCount, n => '<span></span>').join('')}</span>` : ''
        return `<pre class="codeblock hljs ${lineCount > 1 && 'line-numbers'}"><code class="language-${lang}">${highlighted.value}${lineNums}</code></pre>`
      }
    }
    })
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
    .use(mdMdc)

  if (config.underline) {
    md.use(mdUnderline)
  }

  if (config.mdmultiTable) {
    md.use(mdMultiTable, { multiline: true, rowspan: true, headerless: true })
  }

  // --------------------------------
  // PLANTUML
  // --------------------------------

  if (config.plantuml) {
    plantuml.init(md, { server: config.plantumlServerUrl })
  }

  // --------------------------------
  // KROKI
  // --------------------------------

  if (config.kroki) {
    kroki.init(md, { server: config.krokiServerUrl })
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
  katex.__defineMacro('\\tripledash', '{\\vphantom{-}\\raisebox{2.56mu}{$\\mkern2mu' + '\\tiny\\text{-}\\mkern1mu\\text{-}\\mkern1mu\\text{-}\\mkern2mu$}}')

  md.inline.ruler.after('escape', 'katex_inline', katexHelper.katexInline)
  md.renderer.rules.katex_inline = (tokens, idx) => {
    try {
      return katex.renderToString(tokens[idx].content, {
        displayMode: false, macros
      })
    } catch (err) {
      console.warn(err)
      return tokens[idx].content
    }
  }
  md.block.ruler.after('blockquote', 'katex_block', katexHelper.katexBlock, {
    alt: ['paragraph', 'reference', 'blockquote', 'list']
  })
  md.renderer.rules.katex_block = (tokens, idx) => {
    try {
      return '<p>' + katex.renderToString(tokens[idx].content, {
        displayMode: true, macros
      }) + '</p>'
    } catch (err) {
      console.warn(err)
      return tokens[idx].content
    }
  }

  // --------------------------------
  // TWEMOJI
  // --------------------------------

  md.renderer.rules.emoji = (token, idx) => {
    return twemoji.parse(token[idx].content, {
      callback (icon, opts) {
        return `/_assets/svg/twemoji/${icon}.svg`
      }
    })
  }

  return md.render(input)
}
