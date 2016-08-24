"use strict";

jQuery( document ).ready(function( $ ) {

	$('a').smoothScroll({
		speed: 400,
		offset: -20
	});

	var sticky = new Sticky('.stickyscroll');

	var alerts = new Alerts();
	if(alertsData) {
		_.forEach(alertsData, (alertRow) => {
			alerts.push(alertRow);
		});
	}

});