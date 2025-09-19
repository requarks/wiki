const asciidoctor = require('asciidoctor')()
const cheerio = require('cheerio')

module.exports = {
  async render() {
    const html = asciidoctor.convert(this.input, {
      standalone: false,
      safe: this.config.safeMode,
      attributes: {
        showtitle: true,
        icons: 'font'
      }
    })
    // Remove all <foreignObject> elements from the HTML
    let cleanedHtml = html.replace(/<foreignObject[\s\S]*?<\/foreignObject>/g, '')

    const $ = cheerio.load(cleanedHtml, {
      decodeEntities: true
    })

    $('pre.highlight > code.language-diagram').each((i, elm) => {
      const diagramContent = Buffer.from($(elm).html(), 'base64').toString()
      $(elm).parent().replaceWith(`<pre class="diagram">${diagramContent}</div>`)
    })

    return $.html()
  }
}
