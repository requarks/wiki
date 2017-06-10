'use strict'

import MathJax from 'mathjax'
import $ from 'jquery'

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
    MathJax.Hub.Config({
      jax: ['input/TeX', 'input/MathML', 'output/SVG'],
      extensions: ['tex2jax.js', 'mml2jax.js'],
      TeX: {
        extensions: ['AMSmath.js', 'AMSsymbols.js', 'noErrors.js', 'noUndefined.js']
      },
      SVG: {
        scale: 120,
        font: 'STIX-Web'
      },
      tex2jax: {
        preview: 'none'
      },
      showMathMenu: false,
      showProcessingMessages: false,
      messageStyle: 'none'
    })
    MathJax.Hub.Configured()
  }
}
