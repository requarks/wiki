"use strict";

var Promise = require('bluebird'),
	_ = require('lodash'),
	path = require('path'),
	searchIndex = require('search-index'),
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

		let self = this;
		let dbPath = path.resolve(ROOTPATH, appconfig.datadir.db, 'search');

		searchIndex({
			deletable: true,
			fieldedSearch: true,
			indexPath: dbPath,
			logLevel: 'error',
			stopwords: stopWord.getStopwords(appconfig.lang).sort()
		}, (err, si) => {
			if(err) {
				winston.error('Failed to initialize search-index.', err);
			} else {
				self._si = Promise.promisifyAll(si);
			}
		});

		return self;

	},

	find(terms) {

		let self = this;
		terms = _.chain(terms)
							.deburr()
							.toLower()
							.trim()
							.replace(/[^a-z0-9 ]/g, '')
							.value();

		let arrTerms = _.chain(terms)
										.split(' ')
										.filter((f) => { return !_.isEmpty(f); })
										.value();


		return self._si.searchAsync({
			query: {
				AND: [{ '*': arrTerms }]
			},
			pageSize: 10
		}).get('hits').then((hits) => {

			if(hits.length < 5) {
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
			} else {
				return {
					match: hits,
					suggest: []
				};
			}

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
	 * Add a document to the index
	 *
	 * @param      {Object}   content  Document content
	 * @return     {Promise}  Promise of the add operation
	 */
	add(content) {

		let self = this;

		return self.delete(content.entryPath).then(() => {

			return self._si.addAsync({
				entryPath: content.entryPath,
				title: content.meta.title,
				subtitle: content.meta.subtitle || '',
				parent: content.parent.title || '',
				content: content.text || ''
			}, {
				fieldOptions: [{
					fieldName: 'entryPath',
					searchable: true,
					weight: 2
				},
				{
					fieldName: 'title',
					nGramLength: [1, 2],
					searchable: true,
					weight: 3
				},
				{
					fieldName: 'subtitle',
					searchable: true,
					weight: 1,
					store: false
				},
				{
					fieldName: 'parent',
					searchable: false,
				},
				{
					fieldName: 'content',
					searchable: true,
					weight: 0,
					store: false
				}]
			}).then(() => {
				winston.info('Entry ' + content.entryPath + ' added/updated to index.');
				return true;
			}).catch((err) => {
				winston.error(err);
			});

		}).catch((err) => {
			winston.error(err);
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

		return self._si.searchAsync({
			query: {
				AND: [{ 'entryPath': [entryPath] }]
			}
		}).then((results) => {

			if(results.totalHits > 0) {
				let delIds = _.map(results.hits, 'id');
				return self._si.delAsync(delIds);
			} else {
				return true;
			}

		}).catch((err) => {

			if(err.type === 'NotFoundError') {
				return true;
			} else {
				winston.error(err);
			}

		});

	}

};