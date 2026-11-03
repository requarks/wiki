const { JSDOM } = require('jsdom')
const createDOMPurify = require('dompurify')

// Vue directives that are allowed in rendered page content. The page HTML is
// compiled by the Vue template compiler on the client, so any value left on a
// directive would be evaluated as a JavaScript expression. These directives are
// only ever used as valueless flags (e.g. by the tabset renderer), so their
// value is always discarded during sanitization.
const allowedDirectives = ['v-pre', 'v-slot:tabs', 'v-slot:content']

// Any attribute the Vue template compiler could pick up as a directive or a
// binding must never carry author-controlled content.
const directiveAttrRegex = /^(v-|:|@|#)/

module.exports = {
  async init(input, config) {
    if (config.safeHTML) {
      const window = new JSDOM('').window
      const DOMPurify = createDOMPurify(window)

      const allowedAttrs = [...allowedDirectives, 'target']
      const allowedTags = ['tabset', 'template']

      DOMPurify.addHook('uponSanitizeAttribute', (elm, data) => {
        if (allowedDirectives.includes(data.attrName)) {
          // Strip the value so that it can never be compiled as a JS expression
          data.attrValue = ''
        } else if (directiveAttrRegex.test(data.attrName)) {
          data.keepAttr = false
        }
      })

      if (config.allowDrawIoUnsafe) {
        allowedTags.push('foreignObject')
        DOMPurify.addHook('uponSanitizeElement', (elm) => {
          if (elm.querySelectorAll) {
            const breaks = elm.querySelectorAll('foreignObject br, foreignObject p')
            if (breaks && breaks.length) {
              for (let i = 0; i < breaks.length; i++) {
                breaks[i].parentNode.replaceChild(
                  window.document.createElement('div'),
                  breaks[i]
                )
              }
            }
          }
        })
      }

      if (config.allowIFrames) {
        allowedTags.push('iframe')
        allowedAttrs.push('allow')
      }

      input = DOMPurify.sanitize(input, {
        ADD_ATTR: allowedAttrs,
        ADD_TAGS: allowedTags,
        HTML_INTEGRATION_POINTS: { foreignobject: true }
      })
    }
    return input
  }
}
