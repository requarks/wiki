"use strict";

jQuery( document ).ready(function( $ ) {

	// Scroll

	$('a').smoothScroll({
		speed: 400,
		offset: -20
	});

	var sticky = new Sticky('.stickyscroll');

	// Alerts

	var alerts = new Alerts();
	if(alertsData) {
		_.forEach(alertsData, (alertRow) => {
			alerts.push(alertRow);
		});
	}

	// Editor

	if($('#mk-editor').length === 1) {

		let mde = new SimpleMDE({
			autofocus: true,
			element: $("#mk-editor").get(0),
			autoDownloadFontAwesome: false,
			placeholder: 'Enter Markdown formatted content here...',
			hideIcons: ['heading', 'quote'],
			showIcons: ['strikethrough', 'heading-1', 'heading-2', 'heading-3', 'code', 'table', 'horizontal-rule'],
			spellChecker: false
		});

	}

});