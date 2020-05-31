const { JSDOM } = require('jsdom')
const createDOMPurify = require('dompurify')

module.exports = {
  async init(input, config) {
    if (config.safeHTML) {
      const window = new JSDOM('').window
      const DOMPurify = createDOMPurify(window)

      const allowedAttrs = ['v-pre', 'v-slot:tabs', 'v-slot:content']
      const allowedTags = ['tabset', 'template', 'component']

      if (config.allowIFrames) {
        allowedTags.push('iframe')
      }

      DOMPurify.addHook('uponSanitizeElement', (node, data) => {
        if (data.tagName === 'component') {
          try {
            if (node.attributes.is.value === 'style') {
              return
            }
          } catch (e) {
            // attribute does not exist
          }
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
