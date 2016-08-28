"use strict";

var Promise = require('bluebird'),
	path = require('path'),
	fs = Promise.promisifyAll(require("fs")),
	_ = require('lodash'),
	farmhash = require('farmhash'),
	BSONModule = require('bson'),
	BSON = new BSONModule.BSONPure.BSON();

/**
 * Entries Model
 */
module.exports = {

	_repoPath: 'repo',
	_cachePath: 'data/cache',

	/**
	 * Initialize Entries model
	 *
	 * @param      {Object}  appconfig  The application config
	 * @return     {Object}  Entries model instance
	 */
	init(appconfig) {

		let self = this;

		self._repoPath = appconfig.datadir.repo;
		self._cachePath = path.join(appconfig.datadir.db, 'cache');

		return self;

	},

	/**
	 * Fetch an entry from cache, otherwise the original
	 *
	 * @param      {String}  entryPath  The entry path
	 * @return     {Object}  Page Data
	 */
	fetch(entryPath) {

		let self = this;

		let cpath = path.join(self._cachePath, farmhash.fingerprint32(entryPath) + '.bson');

		return fs.statAsync(cpath).then((st) => {
			return st.isFile();
		}).catch((err) => {
			return false;
		}).then((isCache) => {

			if(isCache) {

				// Load from cache

				return fs.readFileAsync(cpath).then((contents) => {
					return BSON.deserialize(contents);
				}).catch((err) => {
					winston.error('Corrupted cache file. Deleting it...');
					fs.unlinkSync(cpath);
					return false;
				});

			} else {

				// Load original

				return self.fetchOriginal(entryPath);

			}

		});

	},

	/**
	 * Fetches the original document entry
	 *
	 * @param      {String}  entryPath  The entry path
	 * @param      {Object}  options    The options
	 * @return     {Object}  Page data
	 */
	fetchOriginal(entryPath, options) {

		let self = this;

		let fpath = path.join(self._repoPath, entryPath + '.md');
		let cpath = path.join(self._cachePath, farmhash.fingerprint32(entryPath) + '.bson');

		options = _.defaults(options, {
			parseMarkdown: true,
			parseMeta: true,
			parseTree: true,
			includeMarkdown: false,
			includeParentInfo: true,
			cache: true
		});

		return fs.statAsync(fpath).then((st) => {
			if(st.isFile()) {
				return fs.readFileAsync(fpath, 'utf8').then((contents) => {

					// Parse contents

					let pageData = {
						markdown: (options.includeMarkdown) ? contents : '',
						html: (options.parseMarkdown) ? mark.parseContent(contents) : '',
						meta: (options.parseMeta) ? mark.parseMeta(contents) : {},
						tree: (options.parseTree) ? mark.parseTree(contents) : []
					};

					if(!pageData.meta.title) {
						pageData.meta.title = _.startCase(entryPath);
					}

					pageData.meta.path = entryPath;

					// Get parent

					let parentPromise = (options.includeParentInfo) ? self.getParentInfo(entryPath).then((parentData) => {
						return (pageData.parent = parentData);
					}).catch((err) => {
						return (pageData.parent = false);
					}) : Promise.resolve(true);

					return parentPromise.then(() => {

						// Cache to disk

						if(options.cache) {
							let cacheData = BSON.serialize(pageData, false, false, false);
							return fs.writeFileAsync(cpath, cacheData).catch((err) => {
								winston.error('Unable to write to cache! Performance may be affected.');
								return true;
							});
						} else {
							return true;
						}

					}).return(pageData);

			 	});
			} else {
				return false;
			}
		});

	},

	/**
	 * Parse raw url path and make it safe
	 *
	 * @param      {String}  urlPath  The url path
	 * @return     {String}  Safe entry path
	 */
	parsePath(urlPath) {

		let wlist = new RegExp('[^a-z0-9/\-]','g');

		urlPath = _.toLower(urlPath).replace(wlist, '');

		if(urlPath === '/') {
			urlPath = 'home';
		}

		let urlParts = _.filter(_.split(urlPath, '/'), (p) => { return !_.isEmpty(p); });

		return _.join(urlParts, '/');

	},

	/**
	 * Gets the parent information.
	 *
	 * @param      {String}        entryPath  The entry path
	 * @return     {Object|False}  The parent information.
	 */
	getParentInfo(entryPath) {

		let self = this;

		if(_.includes(entryPath, '/')) {

			let parentParts = _.split(entryPath, '/');
			let parentPath = _.join(_.initial(parentParts),'/');
			let parentFile = _.last(parentParts);
			let fpath = path.join(self._repoPath, parentPath + '.md');

			return fs.statAsync(fpath).then((st) => {
				if(st.isFile()) {
					return fs.readFileAsync(fpath, 'utf8').then((contents) => {

						let pageMeta = mark.parseMeta(contents);

						return {
							path: parentPath,
							title: (pageMeta.title) ? pageMeta.title : _.startCase(parentFile),
							subtitle: (pageMeta.subtitle) ? pageMeta.subtitle : false
						};

					});
				} else {
					return Promise.reject(new Error('Parent entry is not a valid file.'));
				}
			});

		} else {
			return Promise.reject(new Error('Parent entry is root.'));
		}

	}

};