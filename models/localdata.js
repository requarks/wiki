"use strict";

var fs = require('fs'),
	path = require('path'),
	_ = require('lodash');

/**
 * Local Data Storage
 *
 * @param      {Object}  appconfig  The application configuration
 */
module.exports = {

	_uploadsPath: './repo/uploads',
	_uploadsFolders: [],

	/**
	 * Initialize Local Data Storage model
	 *
	 * @param      {Object}  appconfig  The application config
	 * @return     {Object}  Local Data Storage model instance
	 */
	init(appconfig, skipFolderCreation = false) {

		let self = this;

		self._uploadsPath = path.join(ROOTPATH, appconfig.datadir.db, 'uploads');

		// Create data directories

		if(!skipFolderCreation) {
			self.createBaseDirectories(appconfig);
		}

		return self;

	},

	/**
	 * Creates a base directories (Synchronous).
	 *
	 * @param      {Object}  appconfig  The application config
	 * @return     {Void}  Void
	 */
	createBaseDirectories(appconfig) {

		winston.info('[SERVER] Create data directories if they don\'t exist...');

		try {
			fs.mkdirSync(appconfig.datadir.db);
		} catch (err) {
			if(err.code !== 'EEXIST') {
				winston.error(err);
				process.exit(1);
			}
		}

		try {
			fs.mkdirSync(path.join(appconfig.datadir.db, 'cache'));
		} catch (err) {
			if(err.code !== 'EEXIST') {
				winston.error(err);
				process.exit(1);
			}
		}

		try {
			fs.mkdirSync(path.join(appconfig.datadir.db, 'thumbs'));
		} catch (err) {
			if(err.code !== 'EEXIST') {
				winston.error(err);
				process.exit(1);
			}
		}

		winston.info('[SERVER] Data directories are OK.');

		return;

	},

	/**
	 * Sets the uploads folders.
	 *
	 * @param      {Array<String>}  arrFolders  The arr folders
	 * @return     {Void}  Void
	 */
	setUploadsFolders(arrFolders) {

		this._uploadsFolders = arrFolders;
		return;

	},

	/**
	 * Gets the uploads folders.
	 *
	 * @return     {Array<String>}  The uploads folders.
	 */
	getUploadsFolders() {
		return this._uploadsFolders;
	}

};