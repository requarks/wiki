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
          defs: ['stroke', 'fill', 'stroke-width', 'transform', 'id'],
          div: ['class', 'id', 'style'],
          em: ['class', 'style'],
          figcaption: ['class', 'style', 'id'],
          figure: ['class', 'style', 'id'],
          g: ['transform', 'stroke', 'stroke-width', 'fill'],
          h1: ['class', 'id', 'style'],
          h2: ['class', 'id', 'style'],
          h3: ['class', 'id', 'style'],
          h4: ['class', 'id', 'style'],
          h5: ['class', 'id', 'style'],
          h6: ['class', 'id', 'style'],
          i: ['class', 'id', 'style'],
          img: ['alt', 'class', 'draggable', 'height', 'id', 'src', 'style', 'width'],
          input: ['class', 'disabled', 'type', 'checked', 'id'],
          kbd: ['class'],
          label: ['class', 'id', 'for'],
          li: ['class', 'id', 'style'],
          mark: ['class', 'style'],
          ol: ['class', 'id', 'style', 'start'],
          p: ['class', 'id', 'style'],
          path: ['d', 'style', 'id'],
          pre: ['class', 'id', 'style'],
          section: ['class', 'style'],
          span: ['class', 'style', 'aria-hidden'],
          strong: ['class', 'style'],
          summary: ['class', 'id', 'style'],
          svg: ['width', 'height', 'viewbox', 'preserveaspectratio', 'style'],
          table: ['border', 'class', 'id', 'style', 'width'],
          tabset: [],
          tbody: ['class', 'style'],
          td: ['align', 'class', 'colspan', 'rowspan', 'style', 'valign', 'id'],
          template: ['v-slot:tabs', 'v-slot:content'],
          th: ['align', 'class', 'colspan', 'rowspan', 'style', 'valign', 'id'],
          thead: ['class', 'style'],
          tr: ['class', 'rowspan', 'style', 'align', 'valign', 'id'],
          ul: ['class', 'id', 'style'],
          use: ['href', 'transform']
        },
        css: false
      })
    }
    return input
  }
}
