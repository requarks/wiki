const _ = require('lodash')

module.exports = {
  async render() {
    let output = this.input

    for (let child of this.children) {
      const renderer = require(`../${_.kebabCase(child.key)}/renderer.js`)
      output = await renderer.init(output, child.config)
    }

    return output
  }
}
