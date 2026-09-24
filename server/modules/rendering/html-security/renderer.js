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

      //Changes to keep interactive plantuml object tag

      //only allow specific attributes for plantuml object node
      if (typeof pumlImageFormat !== 'undefined' &&
          pumlImageFormat &&
          pumlImageFormat  == 'svg') {
        allowedTags.push('object')
        allowedAttrs.push('data')
        allowedAttrs.push('type')
        allowedAttrs.push('style')
        allowedAttrs.push('class')
        allowedAttrs.push('alt')
      }

      DOMPurify.addHook('uponSanitizeElement',  (node, data) => {
        // keep object node only if it is
        // authorised plantuml using the configured plantuml server
        // force attribute values to configured params
        // insert the plantuml inside the object as text for search
        let isPumlNode=false

        if (data.tagName === 'object' &&
            typeof pumlServer !== 'undefined' && pumlServer &&
            typeof pumlObjectStyle !== 'undefined' && pumlObjectStyle &&
            typeof pumlObjectType !== 'undefined' && pumlObjectType &&
            typeof pumlObjectClass !== 'undefined' && pumlObjectClass
        ) {
          //console.log ("Found object node - validating")
          //remove node if it doesn't conform to plantuml structure
          if (!( 'data' in node.attributes
                && 'class' in node.attributes
                && 'style' in node.attributes
                && 'type' in node.attributes
                && 'alt' in node.attributes)
          ) {
            //console.log ("Attribute mismatch - removing object node")
            return node.parentNode.removeChild(node)
          }

          dataAttribute = node.getAttribute ('data')

          //only allow configured plantuml server and image format in url
          if (dataAttribute
              && dataAttribute.startsWith(`${pumlServer}/${pumlImageFormat}`)
          ) {
            //console.log ("Plantuml node found - setting atribute values")
            isPumlNode=true
            node.setAttribute ('type', pumlObjectType)
            node.setAttribute ('style', pumlObjectStyle)
            node.setAttribute ('class', pumlObjectClass)
            node.setAttribute ('alt', '')
          }

          //if not a plantuml node, then sanitise it
          if (!isPumlNode) {
            console.log ("Removing unknown object node")
            return node.parentNode.removeChild(node)
          }
        }
      })
      //End changes to keep interactive plantuml object tag

      input = DOMPurify.sanitize(input, {
        ADD_ATTR: allowedAttrs,
        ADD_TAGS: allowedTags,
        HTML_INTEGRATION_POINTS: { foreignobject: true }
      })
    }
    return input
  }
}
