const hljs = require('highlight.js')

module.exports = {
  async init($, config) {
    const codeBlocks = Array.from($('pre > code'))
    await Promise.all(codeBlocks.map(async (elm) => {
      const $elm = $(elm)
      const codeClasses = $elm.attr('class') || ''
      if (!/\blanguage-\w+\b/.test(codeClasses)) {
        const result = hljs.highlightAuto($elm.text())
        if (result.language) {
          $elm.addClass('language-' + result.language)
        }
      }
      $elm.parent().addClass('prismjs line-numbers')
    }))
  }
}
