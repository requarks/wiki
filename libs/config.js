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

	// Merge with defaults

	appconfig = _.defaultsDeep(appconfig, {
		title: "Requarks Wiki",
		host: "http://localhost",
		port: process.env.PORT,
		auth: {
			local: { enabled: true },
			microsoft: { enabled: false },
			google: { enabled: false },
			facebook: { enabled: false },
		},
		db: "mongodb://localhost/wiki",
		redis: null,
		sessionSecret: null,
		admin: null
	});

	// List authentication strategies
	
	appconfig.authStrategies = {
		list: _.filter(appconfig.auth, ['enabled', true]),
		socialEnabled: (_.chain(appconfig.auth).omit('local').reject({ enabled: false }).value().length > 0)
	}
	if(appconfig.authStrategies.list.length < 1) {
		winston.error(new Error('You must enable at least 1 authentication strategy!'));
	  process.exit(1);
	}


	return appconfig;

};