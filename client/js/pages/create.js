/* global $ */

if ($('#page-type-create').length) {
  let pageEntryPath = $('#page-type-create').data('entrypath') // eslint-disable-line no-unused-vars

  // -> Discard

  $('.btn-create-discard').on('click', (ev) => {
    $('#modal-create-discard').toggleClass('is-active')
  })

  /* eslint-disable spaced-comment */
  //=include ../components/editor.js
  /* eslint-enable spaced-comment */
}
