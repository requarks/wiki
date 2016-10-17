"use strict";

var winston = require('winston');

module.exports = (isDebug) => {

	winston.remove(winston.transports.Console);
	winston.add(winston.transports.Console, {
		level: (isDebug) ? 'info' : 'warn',
		prettyPrint: true,
		colorize: true,
		silent: false,
		timestamp: true
	});

	return winston;

};