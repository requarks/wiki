'use strict'

import $ from 'jquery'

module.exports = (alerts) => {
  if ($('#page-type-view').length) {
    let currentBasePath = ($('#page-type-view').data('entrypath') !== 'home') ? $('#page-type-view').data('entrypath') : ''

    require('../modals/create.js')(currentBasePath)
    require('../modals/move.js')(currentBasePath, alerts)
  }
}
