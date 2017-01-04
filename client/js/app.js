"use strict";

jQuery( document ).ready(function( $ ) {

	// ====================================
	// Scroll
	// ====================================

	$('a').smoothScroll({
		speed: 400,
		offset: -70
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
	// Establish WebSocket connection
	// ====================================

	var socket = io(window.location.origin);

	//=include components/search.js

	// ====================================
	// Pages logic
	// ====================================

	//=include pages/view.js
	//=include pages/create.js
	//=include pages/edit.js
	//=include pages/source.js
	//=include pages/admin.js

});

//=include helpers/form.js
//=include helpers/pages.js

//=include components/alerts.js