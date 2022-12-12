const _ = require('lodash')
const nb = require('notebookjs')

module.exports = {
  async render() {
    WIKI.logger.info('Rendering ipynb')

    let ipynb = JSON.parse(this.input)

    let output = nb.parse(ipynb).render().outerHTML

    for (let child of this.children) {
      const renderer = require(`../${_.kebabCase(child.key)}/renderer.js`)
      output = await renderer.init(output, child.config)
    }

    return output
  }
}
