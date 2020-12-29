const { JSDOM } = require('jsdom')
const createDOMPurify = require('dompurify')

module.exports = {
  async init(input, config) {
    if (config.safeHTML) {
      const window = new JSDOM('').window
      const DOMPurify = createDOMPurify(window)

      const allowedAttrs = ['v-pre', 'v-slot:tabs', 'v-slot:content', 'target']
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
        ADD_TAGS: allowedTags
      })
    }
    return input
  }
}
