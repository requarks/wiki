
if($('#page-type-create').length) {

	let pageEntryPath = $('#page-type-create').data('entrypath');

	//-> Discard

	$('.btn-create-discard').on('click', (ev) => {
		$('#modal-create-discard').toggleClass('is-active');
	});

	//=include ../components/editor.js

}