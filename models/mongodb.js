"use strict";

var modb = require('mongoose'),
	 fs   = require("fs"),
	 path = require("path"),
	 _ = require('lodash');

/**
 * MongoDB module
 *
 * @param      {Object}  appconfig  Application config
 * @return     {Object}  Mongoose instance
 */
module.exports = function(appconfig) {

	modb.Promise = require('bluebird');

	let dbModels = {};
	let dbModelsPath = path.join(ROOTPATH, 'models/db');

	// Event handlers

	modb.connection.on('error', (err) => {
		winston.error('Failed to connect to MongoDB instance.');
	});
	modb.connection.once('open', function() {
		winston.log('Connected to MongoDB instance.');
	});

	// Store connection handle

	dbModels.connection = modb.connection;
	dbModels.ObjectId = modb.Types.ObjectId;

	// Load Models

	fs
	.readdirSync(dbModelsPath)
	.filter(function(file) {
		return (file.indexOf(".") !== 0);
	})
	.forEach(function(file) {
		let modelName = _.upperFirst(_.split(file,'.')[0]);
		dbModels[modelName] = require(path.join(dbModelsPath, file));
	});

	// Connect

	dbModels.connectPromise = modb.connect(appconfig.db);

	return dbModels;

};