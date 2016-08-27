"use strict";

var loki = require('lokijs'),
	 fs   = require("fs"),
	 path = require("path"),
	 Promise = require('bluebird'),
	 _ = require('lodash');

var cols = ['User','Entry'];

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
		onReady: dbReady
	};

	// Load Models

	dbModel.Store.loadDatabase({}, () => {

		_.forEach(cols, (col) => {
			dbModel[col] = dbModel.Store.getCollection(col);
			if(!dbModel[col]) {
				dbModel[col] = dbModel.Store.addCollection(col);
			}
		});

		dbReadyResolve();

	});

	return dbModel;

};