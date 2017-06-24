'use strict'

/* global $ */

export default {
  name: 'content-view',
  data() {
    return {}
  },
  mounted() {
    let self = this
    $('a.toc-anchor').each((i, elm) => {
      let hashText = $(elm).attr('href').slice(1)
      $(elm).on('click', (ev) => {
        ev.stopImmediatePropagation()
        self.$store.dispatch('anchor/open', hashText)
        return false
      })
    })
  }
}
