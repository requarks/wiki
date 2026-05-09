module.exports = {
  init($, config) {
    $('pre.prismjs > code.language-vega-lite').each((i, elm) => {
      const vegaLiteContent = $(elm).html()
      $(elm).parent().replaceWith(`<div class="vega-lite">${vegaLiteContent}</div>`)
    })
  }
}
