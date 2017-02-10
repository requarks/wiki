/* global $ */

if ($('#page-type-edit').length) {
  let pageEntryPath = $('#page-type-edit').data('entrypath') // eslint-disable-line no-unused-vars

  // -> Discard

  $('.btn-edit-discard').on('click', (ev) => {
    $('#modal-edit-discard').toggleClass('is-active')
  })

  /* eslint-disable spaced-comment */
  //=include ../components/editor.js
  /* eslint-enable spaced-comment */
}
