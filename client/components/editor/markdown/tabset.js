import cash from 'cash-dom'
import _ from 'lodash'

export default {
  format () {
    for (let i = 1; i < 6; i++) {
      cash(`.editor-markdown-preview-content h${i}.tabset`).each((idx, elm) => {
        elm.innerHTML = 'Tabset ( rendered upon saving )'
        cash(elm).nextUntil(_.times(i, t => `h${t + 1}`).join(', '), `h${i + 1}`).each((hidx, hd) => {
          hd.classList.add('tabset-header')
          cash(hd).nextUntil(_.times(i + 1, t => `h${t + 1}`).join(', ')).wrapAll('<div class="tabset-content"></div>')
        })
      })
    }
  }
}
