const _ = require('lodash')

module.exports = {
  async init($, config) {
    for (let i = 1; i < 6; i++) {
      $(`h${i}.tabset`).each((idx, elm) => {
        let content = `<tabset>`
        let tabs = []
        let tabContents = []
        $(elm).nextUntil(_.times(i, t => `h${t + 1}`).join(', '), `h${i + 1}`).each((hidx, hd) => {
          tabs.push(`<li>${$(hd).html()}</li>`)
          let tabContent = ''
          $(hd).nextUntil(_.times(i + 1, t => `h${t + 1}`).join(', ')).each((cidx, celm) => {
            tabContent += $.html(celm)
            $(celm).remove()
          })
          tabContents.push(`<div class="tabset-panel">${tabContent}</div>`)
          $(hd).remove()
        })
        content += `<template v-slot:tabs>${tabs.join('')}</template>`
        content += `<template v-slot:content>${tabContents.join('')}</template>`
        content += `</tabset>`
        $(elm).replaceWith($(content))
      })
    }
  }
}
