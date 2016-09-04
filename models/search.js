"use strict";

var Promise = require('bluebird'),
	_ = require('lodash'),
	path = require('path'),
	searchIndex = Promise.promisifyAll(require('search-index')),
	stopWord = require('stopword');

/**
 * Search Model
 */
module.exports = {

	_si: null,

	/**
	 * Initialize Search model
	 *
	 * @param      {Object}  appconfig  The application config
	 * @return     {Object}  Search model instance
	 */
	init(appconfig) {

		let dbPath = path.resolve(ROOTPATH, appconfig.datadir.db, 'search-index');

		this._si = searchIndex({
			deletable: true,
			fieldedSearch: true,
			indexPath: dbPath,
			logLevel: 'error',
			stopwords: stopWord.getStopwords(appconfig.lang).sort()
		}, (err, si) => {
			if(err) {
				winston.error('Failed to initialize search-index.', err);
			}
		});

	}



};