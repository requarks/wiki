
if($('#page-type-create').length) {

	//-> Discard

	$('.btn-create-discard').on('click', (ev) => {
		$('#modal-create-discard').toggleClass('is-active');
	});

	//-> Save

	$('.btn-create-save').on('click', (ev) => {

		$.ajax(window.location.href, {
			data: {
				markdown: mde.value()
			},
			dataType: 'json',
			method: 'PUT'
		}).then((rData, rStatus, rXHR) => {
			if(rData.ok) {
				window.location.assign('/' + $('#page-type-create').data('entrypath'));
			} else {
				alerts.pushError('Something went wrong', rData.error);
			}
		}, (rXHR, rStatus, err) => {
			alerts.pushError('Something went wrong', 'Save operation failed.');
		});

	});

}