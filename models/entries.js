"use strict";

var Promise = require('bluebird'),
	path = require('path'),
	fs = Promise.promisifyAll(require("fs")),
	_ = require('lodash'),
	farmhash = require('farmhash'),
	msgpack = require('msgpack5')();

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

	fetch(entryPath) {

		let self = this;

		let fpath = path.join(self._repoPath, entryPath + '.md');
		let cpath = path.join(self._cachePath, farmhash.fingerprint32(entryPath) + '.bin');

		return fs.statAsync(cpath).then((st) => {
			return st.isFile();
		}).catch((err) => {
			return false;
		}).then((isCache) => {

			if(isCache) {

				console.log('from cache!');

				return fs.readFileAsync(cpath, 'utf8').then((contents) => {
					return msgpack.decode(contents);
				}).catch((err) => {
					winston.error('Corrupted cache file. Deleting it...');
					fs.unlinkSync(cpath);
					return false;
				});

			} else {

				console.log('original!');

				// Parse original and cache it

				return fs.statAsync(fpath).then((st) => {
					if(st.isFile()) {
						return fs.readFileAsync(fpath, 'utf8').then((contents) => {
							let pageData = mark.parse(contents);
							if(!pageData.meta.title) {
								pageData.meta.title = entryPath;
							}
							let cacheData = msgpack.encode(pageData);
							return fs.writeFileAsync(cpath, cacheData, { encoding: 'utf8' }).then(() => {
								return pageData;
							}).catch((err) => {
								winston.error('Unable to write to cache! Performance may be affected.');
								return pageData;
							});
					 	});
					} else {
						return false;
					}
				});

			}

		});

		

	},

	parsePath(urlPath) {

		let wlist = new RegExp('[^a-z0-9/\-]','g');

		urlPath = _.toLower(urlPath).replace(wlist, '');

		if(urlPath === '/') {
			urlPath = 'home';
		}

		let urlParts = _.filter(_.split(urlPath, '/'), (p) => { return !_.isEmpty(p); });

		return _.join(urlParts, '/');

	}

};