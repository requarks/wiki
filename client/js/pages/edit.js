
if ($('#page-type-edit').length) {
  let pageEntryPath = $('#page-type-edit').data('entrypath')

	// -> Discard

  $('.btn-edit-discard').on('click', (ev) => {
    $('#modal-edit-discard').toggleClass('is-active')
  })

	// =include ../components/editor.js
}
