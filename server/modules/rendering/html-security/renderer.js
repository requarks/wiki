const { JSDOM } = require('jsdom')
const createDOMPurify = require('dompurify')

module.exports = {
  async init(input, config) {
    if (config.safeHTML) {
      const window = new JSDOM('').window
      const DOMPurify = createDOMPurify(window)

      const allowedAttrs = ['v-pre', 'v-slot:tabs', 'v-slot:content', 'target']
      const allowedTags = ['tabset', 'template']

      if (config.allowIFrames) {
        allowedTags.push('iframe')
      }

      input = DOMPurify.sanitize(input, {
        ADD_ATTR: allowedAttrs,
        ADD_TAGS: allowedTags
      })
    }
    return input
  }
}
