'use strict'

import $ from 'jquery'
import delay from 'lodash/delay'

module.exports = {

  complete () {
    $('#page-loader').addClass('is-loaded')
    delay(() => {
      $('#page-loader').addClass('is-hidden')
    }, 1100)
  }
}
