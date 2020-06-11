const { JSDOM } = require('jsdom')
const createDOMPurify = require('dompurify')
const _ = require('lodash')

module.exports = {
  async init(input, config) {
    if (config.safeHTML) {
      const window = new JSDOM('').window
      const DOMPurify = createDOMPurify(window)

      const allowedAttrs = ['v-pre', 'v-slot:tabs', 'v-slot:content', 'target']
      const allowedTags = ['tabset', 'template', 'component']

      if (config.allowIFrames) {
        allowedTags.push('iframe')
      }

      DOMPurify.addHook('uponSanitizeElement', (node, data) => {
        if (data.tagName === 'component' && _.get(node, ['attributes', 'is', 'value']) !== 'style') {
          node.parentNode.removeChild(node)
        }
      })

      input = DOMPurify.sanitize(input, {
        ADD_ATTR: allowedAttrs,
        ADD_TAGS: allowedTags
      })
    }
    return input
  }
}
