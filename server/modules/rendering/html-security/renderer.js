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
          details: ['class', 'style'],
          div: ['class', 'id', 'style'],
          em: ['class', 'style'],
          figcaption: ['class', 'style'],
          figure: ['class', 'style'],
          h1: ['class', 'id', 'style'],
          h2: ['class', 'id', 'style'],
          h3: ['class', 'id', 'style'],
          h4: ['class', 'id', 'style'],
          h5: ['class', 'id', 'style'],
          h6: ['class', 'id', 'style'],
          img: ['alt', 'class', 'draggable', 'height', 'src', 'style', 'width'],
          input: ['class', 'disabled', 'type', 'checked', 'id'],
          kbd: ['class'],
          label: ['class', 'id', 'for'],
          li: ['class', 'style'],
          mark: ['class', 'style'],
          ol: ['class', 'style'],
          p: ['class', 'style'],
          path: ['d', 'style'],
          pre: ['class', 'style'],
          section: ['class', 'style'],
          span: ['class', 'style', 'aria-hidden'],
          strong: ['class', 'style'],
          summary: ['class', 'style'],
          svg: ['width', 'height', 'viewbox', 'preserveaspectratio', 'style'],
          table: ['border', 'class', 'id', 'style', 'width'],
          tbody: ['class', 'style'],
          td: ['align', 'class', 'colspan', 'rowspan', 'style', 'valign'],
          th: ['align', 'class', 'colspan', 'rowspan', 'style', 'valign'],
          thead: ['class', 'style'],
          tr: ['class', 'rowspan', 'style', 'align', 'valign'],
          ul: ['class', 'style']
        },
        css: false
      })
    }
    return input
  }
}
