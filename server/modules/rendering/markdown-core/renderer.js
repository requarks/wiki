const md = require('markdown-it')
const mdAttrs = require('markdown-it-attrs')
const mdDecorate = require('markdown-it-decorate')
const _ = require('lodash')
const underline = require('./underline')

const quoteStyles = {
  Chinese: '””‘’',
  English: '“”‘’',
  French: ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'],
  German: '„“‚‘',
  Greek: '«»‘’',
  Japanese: '「」「」',
  Hungarian: '„”’’',
  Polish: '„”‚‘',
  Portuguese: '«»‘’',
  Russian: '«»„“',
  Spanish: '«»‘’',
  Swedish: '””’’'
}

// Unicode Private Use Area characters to temporarily replace special
// characters inside math expressions:
// - pipe (|): prevent markdown table parser from interpreting them as cell
//   delimiters.
// - ampersand (&): prevent markdown table parser from interpreting them
//   as cell delimiters in multiline tables.
const PIPE_PLACEHOLDER = '\uE002'
const AMPERSAND_PLACEHOLDER = '\uE003'

/**
 * Replace pipe and ampersand characters inside inline ($...$) and block
 * ($$...$$) math expressions with placeholders to prevent markdown table
 * parsers from splitting formulas containing | (e.g., |x|) or &
 * (e.g., \begin{cases} ... & ... \\ ... \end{cases}).
 */
function protectMathPipes (text) {
  let result = ''
  let i = 0
  while (i < text.length) {
    // Check for block math ($$...$$)
    if (text.slice(i, i + 2) === '$$') {
      const end = text.indexOf('$$', i + 2)
      if (end !== -1) {
        result += text.slice(i, end + 2)
          .replace(/\|/g, PIPE_PLACEHOLDER)
          .replace(/&/g, AMPERSAND_PLACEHOLDER)
        i = end + 2
        continue
      }
    }
    // Check for inline math ($...$)
    if (text[i] === '$' && text[i + 1] !== '$') {
      const end = text.indexOf('$', i + 1)
      if (end !== -1) {
        result += text.slice(i, end + 1)
          .replace(/\|/g, PIPE_PLACEHOLDER)
          .replace(/&/g, AMPERSAND_PLACEHOLDER)
        i = end + 1
        continue
      }
    }
    result += text[i]
    i++
  }
  return result
}

module.exports = {
  async render() {
    const mkdown = md({
      html: this.config.allowHTML,
      breaks: this.config.linebreaks,
      linkify: this.config.linkify,
      typographer: this.config.typographer,
      quotes: _.get(quoteStyles, this.config.quotes, quoteStyles.English),
      highlight(str, lang) {
        if (lang === 'diagram') {
          return `<pre class="diagram">` + Buffer.from(str, 'base64').toString() + `</pre>`
        } else {
          return `<pre><code class="language-${lang}">${_.escape(str)}</code></pre>`
        }
      }
    })

    if (this.config.underline) {
      mkdown.use(underline)
    }

    mkdown.use(mdAttrs, {
      allowedAttributes: ['id', 'class', 'target']
    })
    mkdown.use(mdDecorate)

    for (let child of this.children) {
      const renderer = require(`../${_.kebabCase(child.key)}/renderer.js`)
      await renderer.init(mkdown, child.config)
    }

    // Protect pipe characters inside math expressions before markdown parsing
    const protectedInput = protectMathPipes(this.input)
    return mkdown.render(protectedInput)
  }
}
