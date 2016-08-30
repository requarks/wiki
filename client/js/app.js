"use strict";

jQuery( document ).ready(function( $ ) {

	// ====================================
	// Scroll
	// ====================================

	$('a').smoothScroll({
		speed: 400,
		offset: -20
	});

	var sticky = new Sticky('.stickyscroll');

	// ====================================
	// Notifications
	// ====================================

	$(window).bind('beforeunload', () => {
		$('#notifload').addClass('active');
	});
	$(document).ajaxSend(() => {
		$('#notifload').addClass('active');
	}).ajaxComplete(() => {
		$('#notifload').removeClass('active');
	});

	var alerts = new Alerts();
	if(alertsData) {
		_.forEach(alertsData, (alertRow) => {
			alerts.push(alertRow);
		});
	}

	// ====================================
	// Markdown Editor
	// ====================================

	if($('#mk-editor').length === 1) {

		var mde = new SimpleMDE({
			autofocus: true,
			autoDownloadFontAwesome: false,
			element: $("#mk-editor").get(0),
			hideIcons: ['heading', 'quote'],
			placeholder: 'Enter Markdown formatted content here...',
			showIcons: ['strikethrough', 'heading-1', 'heading-2', 'heading-3', 'code', 'table', 'horizontal-rule'],
			spellChecker: false,
			status: false
		});

	}

	// ====================================
	// Pages logic
	// ====================================

	//=include pages/view.js
	//=include pages/create.js
	//=include pages/edit.js
	//=include pages/source.js

});

//=include helpers/form.js
//=include helpers/pages.js