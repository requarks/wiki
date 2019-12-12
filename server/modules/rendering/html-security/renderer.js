const xss = require('xss')

module.exports = {
  async init(input, config) {
    if (config.safeHTML) {
      input = xss(input, {
        whiteList: {
          ...xss.whiteList,
          a: ['class', 'id', 'href', 'target', 'title'],
          blockquote: ['class', 'id'],
          code: ['class'],
          div: ['class', 'id'],
          em: ['class'],
          h1: ['class', 'id'],
          h2: ['class', 'id'],
          h3: ['class', 'id'],
          h4: ['class', 'id'],
          h5: ['class', 'id'],
          h6: ['class', 'id'],
          img: ['alt', 'class', 'draggable', 'height', 'src', 'width'],
          li: ['class'],
          ol: ['class'],
          p: ['class'],
          pre: ['class'],
          strong: ['class'],
          table: ['border', 'class', 'id', 'width'],
          tbody: ['class'],
          td: ['align', 'class', 'colspan', 'rowspan', 'valign'],
          th: ['align', 'class', 'colspan', 'rowspan', 'valign'],
          thead: ['class'],
          tr: ['class', 'rowspan', 'align', 'valign'],
          ul: ['class']
        }
      })
    }
    return input
  }
}
