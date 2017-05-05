'use strict'

/* eslint-disable no-new */

import $ from 'jquery'
import MathJax from 'mathjax'
import * as CopyPath from '../components/copy-path.vue'
import Vue from 'vue'

module.exports = (alerts) => {
  if ($('#page-type-view').length) {
    let currentBasePath = ($('#page-type-view').data('entrypath') !== 'home') ? $('#page-type-view').data('entrypath') : ''

    // Copy Path

    new Vue({
      el: '.modal-copypath',
      render: h => h(CopyPath)
    })

    // MathJax Render

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

    require('../modals/create.js')(currentBasePath)
    require('../modals/move.js')(currentBasePath, alerts)
  }
}
