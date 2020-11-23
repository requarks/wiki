const { JSDOM } = require('jsdom')
const createDOMPurify = require('dompurify')

module.exports = {
  async init(input, config) {
    if (config.safeHTML) {
      const window = new JSDOM('').window
      const DOMPurify = createDOMPurify(window)

      const allowedAttrs = ['v-pre', 'v-slot:tabs', 'v-slot:content', 'target', 'data', 'style', 'class']
      const allowedTags = ['tabset', 'template', 'object']

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
        /*
        onIgnoreTag: function(tag, html, options) {
          // Allow the object tag only if object data attr begins with
          // "$plantumlServer/$plantumlImageFormat...."
          // i.e. the configured plantuml server and format in plantuml renderer
          // these attrs are declared in markdown-plantuml module
          // & class="uml-diagram" />
          // i.e. created by the plantuml renderer

          let searchAttr = `${pumlSearchAttr}`

          if (tag === 'object' &&
              html.includes(' class="uml-diagram"') &&
              html.includes(' data="' + `${pumlServer}/${pumlImageFormat}`) &&
              html.includes(' ' + searchAttr + '="')
          ) {
            // this is a plantuml object; mark it so that the
            // closing tag can be handled correctly
            puObjectTag = true

            // put the plantuml (contained in attr puml="<plantuml>") in the content
            // so that it's searchable & in a code block so that browsers
            // that don't render <object> will render this nicely

            let pumlIndex = html.indexOf(searchAttr)
            let puml = getAttrValue(searchAttr, html)
            let pumlURL = getAttrValue('data', html)
            let objStyle = getAttrValue('style', html)

            return (
              '<object data="' + pumlURL + '" class="uml-diagram" type="image/svg+xml" style="'+ objStyle +'" >' +
              '<img src="' + pumlURL + '" />' +
              '<pre class="prismjs line-numbers"><code class="language-plantuml">' +
              puml +
              '</code></pre>'
            )
          } else if (tag === 'object' && options.isClosing) {
            // return </object>  if
            // it is linked to a plantuml <object>
            if (typeof puObjectTag !== 'undefined' && puObjectTag === true) {
              puObjectTag = false
              return html
            } else {
              // normal behaviour for converting </object> to text
              return html.replace(/</g, '&lt;').replace(/>/g, '&gt;')
            }
          }
        }*/
      })
    }
    return input
  }
}

//function to retrieve value for attribute from a string
function getAttrValue (attr, html) {
  let index = html.indexOf(attr)
  let contents = html.substr(index + attr.length + 2)
  contents = contents.substr(0, contents.indexOf('"'))
  return contents
}
