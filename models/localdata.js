"use strict";

var fs = require('fs'),
	_ = require('lodash');

/**
 * Local Data Storage
 *
 * @param      {Object}  appconfig  The application configuration
 */
module.exports = (appconfig) => {

	// Create DB folder

	try {
		fs.mkdirSync(appconfig.datadir.db);
	} catch (err) {
		if(err.code !== 'EEXIST') {
			winston.error(err);
			process.exit(1);
		}
	}

	// Create Uploads folder

	try {
		fs.mkdirSync(appconfig.datadir.uploads);
	} catch (err) {
		if(err.code !== 'EEXIST') {
			winston.error(err);
			process.exit(1);
		}
	}

};