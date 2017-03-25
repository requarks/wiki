/* global $ */

if ($('#page-type-edit').length) {
  let pageEntryPath = $('#page-type-edit').data('entrypath') // eslint-disable-line no-unused-vars
  // let pageCleanExit = false

  // -> Discard

  $('.btn-edit-discard').on('click', (ev) => {
    $('#modal-edit-discard').toggleClass('is-active')
  })

  // window.onbeforeunload = function () {
  //   return (pageCleanExit) ? true : 'Unsaved modifications will be lost. Are you sure you want to navigate away from this page?'
  // }

  /* eslint-disable spaced-comment */
  //=include ../components/editor.js
  /* eslint-enable spaced-comment */
}
