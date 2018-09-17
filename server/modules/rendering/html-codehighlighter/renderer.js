const hljs = require('highlight.js')

module.exports = {
  async init($, config) {
    $('pre > code').each((idx, elm) => {
      const codeClasses = $(elm).attr('class') || ''
      if (codeClasses.indexOf('language-') < 0) {
        const result = hljs.highlightAuto($(elm).text())
        $(elm).addClass('language-', result.language)
      }
      $(elm).parent().addClass('prismjs line-numbers')
    })
  }
}
