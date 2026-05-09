module.exports = {
  init($, config) {
    $('pre.prismjs > code.language-vega').each((i, elm) => {
      const vegaContent = $(elm).html()
      $(elm).parent().replaceWith(`<div class="vega">${vegaContent}</div>`)
    })
  }
}
