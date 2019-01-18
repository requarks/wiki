const _ = require('lodash')
const cheerio = require('cheerio')

module.exports = {
  async render() {
    const $ = cheerio.load(this.input)

    if ($.root().children().length < 1) {
      return ''
    }

    for (let child of this.children) {
      const renderer = require(`../${_.kebabCase(child.key)}/renderer.js`)
      renderer.init($, child.config)
    }

    return $.html('body').replace('<body>', '').replace('</body>', '')
  }
}
