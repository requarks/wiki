
if($('#page-type-edit').length) {

	//-> Discard

	$('.btn-edit-discard').on('click', (ev) => {
		$('#modal-edit-discard').toggleClass('is-active');
	});

	//-> Save

	$('.btn-edit-save').on('click', (ev) => {

		$.ajax(window.location.href, {
			data: {
				markdown: mde.value()
			},
			dataType: 'json',
			method: 'PUT'
		}).then((rData, rStatus, rXHR) => {
			if(rData.ok) {
				window.location.assign('/' + $('#page-type-edit').data('entrypath'));
			} else {
				alerts.pushError('Something went wrong', rData.error);
			}
		}, (rXHR, rStatus, err) => {
			alerts.pushError('Something went wrong', 'Save operation failed.');
		});

	});

}