"use strict";

const Promise = require('bluebird'),
			_ = require('lodash'),
			path = require('path');

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

		let self = this;

		return self;

	},

	find(terms) {

		let self = this;
		terms = _.chain(terms)
							.deburr()
							.toLower()
							.trim()
							.replace(/[^a-z0-9 ]/g, '')
							.split(' ')
							.filter((f) => { return !_.isEmpty(f); })
							.join(' ')
							.value();

		return db.Entry.find(
			{ $text: { $search: terms } },
			{ score: { $meta: "textScore" }, title: 1 }
		)
		.sort({ score: { $meta: "textScore" } })
		.limit(10)
		.exec()
		.then((hits) => {

			/*if(hits.length < 5) {
				return self._si.matchAsync({
					beginsWith: terms,
					threshold: 3,
					limit: 5,
					type: 'simple'
				}).then((matches) => {

					return {
						match: hits,
						suggest: matches
					};

				});
			} else {*/
				return {
					match: hits,
					suggest: []
				};
			//}

		}).catch((err) => {

			if(err.type === 'NotFoundError') {
				return {
					match: [],
					suggest: []
				};
			} else {
				winston.error(err);
			}

		});

	},

	/**
	 * Delete an entry from the index
	 *
	 * @param      {String}   The     entry path
	 * @return     {Promise}  Promise of the operation
	 */
	delete(entryPath) {

		let self = this;
		/*let hasResults = false;

		return new Promise((resolve, reject) => {

			self._si.search({
				query: {
					AND: { 'entryPath': [entryPath] }
				}
			}).on('data', (results) => {

				hasResults = true;

				if(results.totalHits > 0) {
					let delIds = _.map(results.hits, 'id');
					self._si.del(delIds).on('end', () => { return resolve(true); });
				} else {
					resolve(true);
				}

			}).on('error', (err) => {

				if(err.type === 'NotFoundError') {
					resolve(true);
				} else {
					winston.error(err);
					reject(err);
				}

			}).on('end', () => {
				if(!hasResults) {
					resolve(true);
				}
			});

		});*/

	}

};