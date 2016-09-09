"use strict";

var Promise = require('bluebird'),
	path = require('path'),
	fs = Promise.promisifyAll(require("fs-extra")),
	_ = require('lodash'),
	farmhash = require('farmhash'),
	BSONModule = require('bson'),
	BSON = new BSONModule.BSONPure.BSON(),
	moment = require('moment');

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

		self._repoPath = path.resolve(ROOTPATH, appconfig.datadir.repo);
		self._cachePath = path.resolve(ROOTPATH, appconfig.datadir.db, 'cache');

		return self;

	},

	/**
	 * Check if a document already exists
	 *
	 * @param      {String}  entryPath  The entry path
	 * @return     {Promise<Boolean>}  True if exists, false otherwise
	 */
	exists(entryPath) {

		let self = this;

		return self.fetchOriginal(entryPath, {
			parseMarkdown: false,
			parseMeta: false,
			parseTree: false,
			includeMarkdown: false,
			includeParentInfo: false,
			cache: false
		}).then(() => {
			return true;
		}).catch((err) => {
			return false;
		});

	},

	/**
	 * Fetch a document from cache, otherwise the original
	 *
	 * @param      {String}           entryPath  The entry path
	 * @return     {Promise<Object>}  Page Data
	 */
	fetch(entryPath) {

		let self = this;

		let cpath = self.getCachePath(entryPath);

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
	 * @param      {String}           entryPath  The entry path
	 * @param      {Object}           options    The options
	 * @return     {Promise<Object>}  Page data
	 */
	fetchOriginal(entryPath, options) {

		let self = this;

		let fpath = self.getFullPath(entryPath);
		let cpath = self.getCachePath(entryPath);

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
							let cacheData = BSON.serialize(_.pick(pageData, ['html', 'meta', 'tree', 'parent']), false, false, false);
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
		}).catch((err) => {
			return Promise.reject(new Error('Entry ' + entryPath + ' does not exist!'));
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
	 * @param      {String}                 entryPath  The entry path
	 * @return     {Promise<Object|False>}  The parent information.
	 */
	getParentInfo(entryPath) {

		let self = this;

		if(_.includes(entryPath, '/')) {

			let parentParts = _.initial(_.split(entryPath, '/'));
			let parentPath = _.join(parentParts,'/');
			let parentFile = _.last(parentParts);
			let fpath = self.getFullPath(parentPath);

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

	},

	/**
	 * Gets the full original path of a document.
	 *
	 * @param      {String}  entryPath  The entry path
	 * @return     {String}  The full path.
	 */
	getFullPath(entryPath) {
		return path.join(this._repoPath, entryPath + '.md');
	},

	/**
	 * Gets the full cache path of a document.
	 *
	 * @param      {String}    entryPath  The entry path
	 * @return     {String}  The full cache path.
	 */
	getCachePath(entryPath) {
		return path.join(this._cachePath, farmhash.fingerprint32(entryPath) + '.bson');
	},

	/**
	 * Gets the entry path from full path.
	 *
	 * @param      {String}  fullPath  The full path
	 * @return     {String}  The entry path
	 */
	getEntryPathFromFullPath(fullPath) {
		let absRepoPath = path.resolve(ROOTPATH, this._repoPath);
		return _.chain(fullPath).replace(absRepoPath, '').replace('.md', '').replace(new RegExp('\\\\', 'g'),'/').value();
	},

	/**
	 * Update an existing document
	 *
	 * @param      {String}            entryPath  The entry path
	 * @param      {String}            contents   The markdown-formatted contents
	 * @return     {Promise<Boolean>}  True on success, false on failure
	 */
	update(entryPath, contents) {

		let self = this;
		let fpath = self.getFullPath(entryPath);

		return fs.statAsync(fpath).then((st) => {
			if(st.isFile()) {
				return self.makePersistent(entryPath, contents).then(() => {
					return self.updateCache(entryPath);
				});
			} else {
				return Promise.reject(new Error('Entry does not exist!'));
			}
		}).catch((err) => {
			winston.error(err);
			return Promise.reject(new Error('Failed to save document.'));
		});

	},

	/**
	 * Update local cache and search index
	 *
	 * @param      {String}   entryPath  The entry path
	 * @return     {Promise}  Promise of the operation
	 */
	updateCache(entryPath) {

		let self = this;

		return self.fetchOriginal(entryPath, {
			parseMarkdown: true,
			parseMeta: true,
			parseTree: true,
			includeMarkdown: true,
			includeParentInfo: true,
			cache: true
		}).then((pageData) => {
			return {
				entryPath,
				meta: pageData.meta,
				parent: pageData.parent || {},
				text: mark.removeMarkdown(pageData.markdown)
			};
		}).then((content) => {
			ws.emit('searchAdd', {
				auth: WSInternalKey,
				content
			});
			return true;
		});

	},

	/**
	 * Create a new document
	 *
	 * @param      {String}            entryPath  The entry path
	 * @param      {String}            contents   The markdown-formatted contents
	 * @return     {Promise<Boolean>}  True on success, false on failure
	 */
	create(entryPath, contents) {

		let self = this;

		return self.exists(entryPath).then((docExists) => {
			if(!docExists) {
				return self.makePersistent(entryPath, contents).then(() => {
					return self.updateCache(entryPath);
				});
			} else {
				return Promise.reject(new Error('Entry already exists!'));
			}
		}).catch((err) => {
			winston.error(err);
			return Promise.reject(new Error('Something went wrong.'));
		});

	},

	/**
	 * Makes a document persistent to disk and git repository
	 *
	 * @param      {String}            entryPath  The entry path
	 * @param      {String}            contents   The markdown-formatted contents
	 * @return     {Promise<Boolean>}  True on success, false on failure
	 */
	makePersistent(entryPath, contents) {

		let self = this;
		let fpath = self.getFullPath(entryPath);

		return fs.outputFileAsync(fpath, contents).then(() => {
			return git.commitDocument(entryPath);
		});

	},

	/**
	 * Move a document
	 *
	 * @param      {String}   entryPath     The current entry path
	 * @param      {String}   newEntryPath  The new entry path
	 * @return     {Promise}  Promise of the operation
	 */
	move(entryPath, newEntryPath) {

		let self = this;

		return git.moveDocument(entryPath, newEntryPath).then(() => {
			return git.commitDocument(newEntryPath).then(() => {
				return self.updateCache(newEntryPath);
			});
		});

	},

	/**
	 * Generate a starter page content based on the entry path
	 *
	 * @param      {String}           entryPath  The entry path
	 * @return     {Promise<String>}  Starter content
	 */
	getStarter(entryPath) {

		let self = this;
		let formattedTitle = _.startCase(_.last(_.split(entryPath, '/')));

		return fs.readFileAsync(path.join(ROOTPATH, 'client/content/create.md'), 'utf8').then((contents) => {
			return _.replace(contents, new RegExp('{TITLE}', 'g'), formattedTitle);
		});

	}

};