"use strict";

var fs = require('fs'),
	yaml = require('js-yaml'),
	_ = require('lodash');

/**
 * Load Application Configuration
 *
 * @param      {String}  confPath  Path to the configuration file
 * @return     {Object}  Application Configuration
 */
module.exports = (confPath) => {

	var appconfig = {};

	try {
	  appconfig = yaml.safeLoad(fs.readFileSync(confPath, 'utf8'));
	} catch (ex) {
	  winston.error(ex);
	  process.exit(1);
	}

	return _.defaultsDeep(appconfig, {
		title: "Requarks Wiki",
		host: "http://localhost",
		port: process.env.PORT,
		wsPort: 8080,
		db: "mongodb://localhost/wiki",
		redis: null,
		sessionSecret: null,
		admin: null
	});

};