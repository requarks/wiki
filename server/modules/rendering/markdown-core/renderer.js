const md = require('markdown-it')
// const hljs = require('highlight.js')
const _ = require('lodash')

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

module.exports = {
  async render() {
    const mkdown = md({
      html: this.config.allowHTML,
      breaks: this.config.linebreaks,
      linkify: this.config.linkify,
      typographer: this.config.typographer,
      quotes: _.get(quoteStyles, this.config.quotes, quoteStyles.English),
      highlight(str, lang) {
        // if (this.config.highlightCode && lang && hljs.getLanguage(lang)) {
        //   try {
        //     return '<pre class="hljs"><code>' + hljs.highlight(lang, str, true).value + '</code></pre>'
        //   } catch (err) {
        //     return '<pre><code>' + _.escape(str) + '</code></pre>'
        //   }
        // }
        return '<pre><code>' + _.escape(str) + '</code></pre>'
      }
    })

    return mkdown.render(this.input)
  }
}
