"use strict";

var fs = require('fs'),
	path = require('path'),
	_ = require('lodash');

/**
 * Local Data Storage
 *
 * @param      {Object}  appconfig  The application configuration
 */
module.exports = (appconfig) => {

	// Create data directories

	try {
		fs.mkdirSync(appconfig.datadir.db);
	} catch (err) {
		if(err.code !== 'EEXIST') {
			winston.error(err);
			process.exit(1);
		}
	}

	try {
		fs.mkdirSync(path.join(appconfig.datadir.db, 'cache'));
	} catch (err) {
		if(err.code !== 'EEXIST') {
			winston.error(err);
			process.exit(1);
		}
	}

};