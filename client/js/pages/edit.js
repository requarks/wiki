'use strict'

import $ from 'jquery'

module.exports = (alerts, socket) => {
  if ($('#page-type-edit').length) {
    let pageEntryPath = $('#page-type-edit').data('entrypath')
    // let pageCleanExit = false

    // -> Discard

    $('.btn-edit-discard').on('click', (ev) => {
      $('#modal-edit-discard').toggleClass('is-active')
    })

    // window.onbeforeunload = function () {
    //   return (pageCleanExit) ? true : 'Unsaved modifications will be lost. Are you sure you want to navigate away from this page?'
    // }

    require('../components/editor.js')(alerts, pageEntryPath, socket)
  }
}
