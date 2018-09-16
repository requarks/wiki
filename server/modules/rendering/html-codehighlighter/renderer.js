const hljs = require('highlight.js')

module.exports = {
  async init($, config) {
    $('pre > code').each((idx, elm) => {
      const lang = $(elm).attr('lang')
      if (lang) {
        $(elm).html(hljs.highlight(lang, $(elm).text(), true).value)
      } else {
        const result = hljs.highlightAuto($(elm).text())
        $(elm).html(result.value)
        $(elm).attr('lang', result.language)
      }
      $(elm).parent().addClass('hljs')
    })
  }
}
