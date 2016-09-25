"use strict";

var fs = require('fs'),
	path = require('path'),
	loki = require('lokijs'),
	Promise = require('bluebird'),
	_ = require('lodash');

/**
 * Local Data Storage
 *
 * @param      {Object}  appconfig  The application configuration
 */
module.exports = {

	_uploadsPath: './repo/uploads',
	_uploadsThumbsPath: './data/thumbs',
	_uploadsFolders: [],
	_uploadsDb: null,

	/**
	 * Initialize Local Data Storage model
	 *
	 * @param      {Object}  appconfig  The application config
	 * @return     {Object}  Local Data Storage model instance
	 */
	init(appconfig, mode = 'server') {

		let self = this;

		self._uploadsPath = path.resolve(ROOTPATH, appconfig.datadir.repo, 'uploads');
		self._uploadsThumbsPath = path.resolve(ROOTPATH, appconfig.datadir.db, 'thumbs');


		// Start in full or bare mode

		switch(mode) {
			case 'agent':
				//todo
			break;
			case 'server':
				self.createBaseDirectories(appconfig);
			break;
			case 'ws':
				self.initDb(appconfig);
			break;
		}

		return self;

	},

	/**
	 * Initialize Uploads DB
	 *
	 * @param      {Object}   appconfig  The application config
	 * @return     {boolean}  Void
	 */
	initDb(appconfig) {

		let self = this;

		let dbReadyResolve;
		let dbReady = new Promise((resolve, reject) => {
			dbReadyResolve = resolve;
		});

		// Initialize Loki.js

		let dbModel = {
			Store: new loki(path.join(appconfig.datadir.db, 'uploads.db'), {
				env: 'NODEJS',
				autosave: true,
				autosaveInterval: 15000
			}),
			onReady: dbReady
		};

		// Load Models

		dbModel.Store.loadDatabase({}, () => {

			dbModel.Files = dbModel.Store.getCollection('Files');
			if(!dbModel.Files) {
				dbModel.Files = dbModel.Store.addCollection('Files', {
					indices: ['category', 'folder']
				});
			}

			dbReadyResolve();

		});

		self._uploadsDb = dbModel;

		return true;

	},

	/**
	 * Gets the thumbnails folder path.
	 *
	 * @return     {String}  The thumbs path.
	 */
	getThumbsPath() {
		return this._uploadsThumbsPath;
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
	},

	/**
	 * Sets the uploads files.
	 *
	 * @param      {Array<Object>}  arrFiles  The uploads files
	 * @return     {Void}  Void
	 */
	setUploadsFiles(arrFiles) {

		let self = this;

		if(_.isArray(arrFiles) && arrFiles.length > 0) {
			self._uploadsDb.Files.clear();
			self._uploadsDb.Files.insert(arrFiles);
			self._uploadsDb.Files.ensureIndex('category', true);
			self._uploadsDb.Files.ensureIndex('folder', true);
		}

		return;

	},

	/**
	 * Gets the uploads files.
	 *
	 * @param      {String}  cat     Category type
	 * @param      {String}  fld     Folder
	 * @return     {Array<Object>}  The files matching the query
	 */
	getUploadsFiles(cat, fld) {

		return this._uploadsDb.Files.find({
			'$and': [{ 'category' : cat	},{ 'folder' : fld }]
		});

	},

	/**
	 * Generate thumbnail of image
	 *
	 * @param      {String}           sourcePath  The source path
	 * @return     {Promise<Object>}  Promise returning the resized image info
	 */
	generateThumbnail(sourcePath, destPath) {

		let sharp = require('sharp');

		return sharp(sourcePath)
						.withoutEnlargement()
						.resize(150,150)
						.background('white')
						.embed()
						.flatten()
						.toFormat('png')
						.toFile(destPath);

	},

	/**
	 * Gets the image metadata.
	 *
	 * @param      {String}  sourcePath  The source path
	 * @return     {Object}  The image metadata.
	 */
	getImageMetadata(sourcePath) {

		let sharp = require('sharp');

		return sharp(sourcePath).metadata();

	}

};