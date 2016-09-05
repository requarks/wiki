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
		let dbPath = path.resolve(ROOTPATH, appconfig.datadir.db, 'search-index');

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
							.split(' ')
							.filter((f) => { return !_.isEmpty(f); })
							.value();

		return self._si.searchAsync({
			query: {
				AND: [{ '*': terms }]
			},
			pageSize: 10
		}).get('hits');

	},

	/**
	 * Add a document to the index
	 *
	 * @param      {Object}   content  Document content
	 * @return     {Promise}  Promise of the add operation
	 */
	add(content) {

		let self = this;

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
				fieldName: 'subtitle',
				searchable: false,
			},
			{
				fieldName: 'content',
				searchable: true,
				weight: 0,
				store: false
			}]
		}).then(() => {
			winston.info('Entry ' + content.entryPath + ' added to index.');
		}).catch((err) => {
			winston.error(err);
		});

	}

};