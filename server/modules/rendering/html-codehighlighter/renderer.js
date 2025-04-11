const hljs = require('highlight.js')

module.exports = {
  async init($, config) {
    $('pre > code').each((idx, elm) => {
      const codeClasses = $(elm).attr('class') || ''
      if (codeClasses.indexOf('language-') < 0) {
        const result = hljs.highlightAuto($(elm).text())
        $(elm).addClass('language-', result.language)
        $(elm).addClass('match-braces') // Ruslan: I don't sure if this line needed or not :)
      }
      $(elm).parent().addClass('prismjs line-numbers match-braces')
    })
  }
}
