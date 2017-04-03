'use strict'

import $ from 'jquery'
import _ from 'lodash'

module.exports = {

  complete () {
    $('#page-loader').addClass('is-loaded')
    _.delay(() => {
      $('#page-loader').addClass('is-hidden')
    }, 1100)
  }
}
