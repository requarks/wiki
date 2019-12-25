const xss = require('xss')

module.exports = {
  async init(input, config) {
    if (config.safeHTML) {
      input = xss(input, {
        whiteList: {
          ...xss.whiteList,
          a: ['class', 'id', 'href', 'style', 'target', 'title'],
          blockquote: ['class', 'id', 'style'],
          code: ['class', 'style'],
          div: ['class', 'id', 'style'],
          em: ['class', 'style'],
          h1: ['class', 'id', 'style'],
          h2: ['class', 'id', 'style'],
          h3: ['class', 'id', 'style'],
          h4: ['class', 'id', 'style'],
          h5: ['class', 'id', 'style'],
          h6: ['class', 'id', 'style'],
          img: ['alt', 'class', 'draggable', 'height', 'src', 'style', 'width'],
          li: ['class', 'style'],
          ol: ['class', 'style'],
          p: ['class', 'style'],
          path: ['d', 'style'],
          pre: ['class', 'style'],
          span: ['class', 'style'],
          strong: ['class', 'style'],
          svg: ['width', 'height', 'viewBox', 'preserveAspectRatio', 'style'],
          table: ['border', 'class', 'id', 'style', 'width'],
          tbody: ['class', 'style'],
          td: ['align', 'class', 'colspan', 'rowspan', 'style', 'valign'],
          th: ['align', 'class', 'colspan', 'rowspan', 'style', 'valign'],
          thead: ['class', 'style'],
          tr: ['class', 'rowspan', 'style', 'align', 'valign'],
          ul: ['class', 'style']
        },
        css: false,
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

            return (
              html.substr(0, pumlIndex) + ' >' +
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
        }
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
