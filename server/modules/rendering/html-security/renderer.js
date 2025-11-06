const { JSDOM } = require('jsdom')
const createDOMPurify = require('dompurify')

module.exports = {
  async init(input, config) {
    if (config.safeHTML) {
      const window = new JSDOM('').window
      const DOMPurify = createDOMPurify(window)

      // Allowed attributes extended to preserve image resize information.
      // The CKEditor ImageResize plugin stores user-defined dimensions via inline styles (width) on <img>.
      // Without allowing 'style', DOMPurify strips the width and images revert to original dimensions, appearing elongated.
      // Security note: DOMPurify sanitizes CSS properties; allowing style here is a targeted UX fix.
      const allowedAttrs = ['v-pre', 'v-slot:tabs', 'v-slot:content', 'target', 'style', 'width', 'height']
      const allowedTags = ['tabset', 'template']

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
        ADD_TAGS: allowedTags
      })
    }
    input = input.replace(/<foreignObject[\s\S]*?<\/foreignObject>/g, '')
    return input
  }
}
