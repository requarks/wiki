const asciidoctor = require('asciidoctor')()
const registry = asciidoctor.Extensions.create()
require('../../../../client/modules/asciidoc-extended')(registry)
const cheerio = require('cheerio')

module.exports = {
  async render() {
    const html = asciidoctor.convert(this.input, {
      standalone: false,
      safe: this.config.safeMode,
      attributes: {
        showtitle: true,
        icons: 'font'
      },
      'extension_registry': registry
    })

    const $ = cheerio.load(html, {
      decodeEntities: true
    })

    $('pre.highlight > code.language-diagram').each((i, elm) => {
      const diagramContent = Buffer.from($(elm).html(), 'base64').toString()
      $(elm).parent().replaceWith(`<pre class="diagram">${diagramContent}</div>`)
    })

    return $.html()
  }
}
