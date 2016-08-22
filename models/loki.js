"use strict";

var loki = require('lokijs'),
	 fs   = require("fs"),
	 path = require("path"),
	 Promise = require('bluebird'),
	 _ = require('lodash');

/**
 * Loki.js module
 *
 * @param      {Object}  appconfig  Application config
 * @return     {Object}  LokiJS instance
 */
module.exports = function(appconfig) {

	let dbReadyResolve;
	let dbReady = new Promise((resolve, reject) => {
		dbReadyResolve = resolve;
	});

	// Initialize Loki.js

	let dbModel = {
		Store: new loki(path.join(appconfig.datadir.db, 'app.db'), {
			env: 'NODEJS',
			autosave: true,
			autosaveInterval: 5000
		}),
		Models: {},
		onReady: dbReady
	};

	// Load Models

	let dbModelsPath = path.join(ROOTPATH, 'models/db');

	dbModel.Store.loadDatabase({}, () => {

		fs
		.readdirSync(dbModelsPath)
		.filter(function(file) {
			return (file.indexOf(".") !== 0);
		})
		.forEach(function(file) {
			let modelName = _.upperFirst(_.split(file,'.')[0]);
			dbModel.Models[modelName] = require(path.join(dbModelsPath, file));
			dbModel[modelName] = dbModel.Store.getCollection(modelName);
			if(!dbModel[modelName]) {
				dbModel[modelName] = dbModel.Store.addCollection(modelName);
			}
		});

		dbReadyResolve();

	});

	return dbModel;

};