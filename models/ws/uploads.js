"use strict";

var path = require('path'),
	Promise = require('bluebird'),
	fs = Promise.promisifyAll(require('fs-extra')),
	multer  = require('multer'),
	_ = require('lodash');

var regFolderName = new RegExp("^[a-z0-9][a-z0-9\-]*[a-z0-9]$");

/**
 * Uploads
 */
module.exports = {

	_uploadsPath: './repo/uploads',
	_uploadsThumbsPath: './data/thumbs',

	/**
	 * Initialize Local Data Storage model
	 *
	 * @param      {Object}  appconfig  The application config
	 * @return     {Object}  Uploads model instance
	 */
	init(appconfig) {

		this._uploadsPath = path.resolve(ROOTPATH, appconfig.paths.repo, 'uploads');
		this._uploadsThumbsPath = path.resolve(ROOTPATH, appconfig.paths.data, 'thumbs');

		return this;

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
	 * Creates an uploads folder.
	 *
	 * @param      {String}  folderName  The folder name
	 * @return     {Promise}  Promise of the operation
	 */
	createUploadsFolder(folderName) {

		let self = this;

		folderName = _.kebabCase(_.trim(folderName));

		if(_.isEmpty(folderName) || !regFolderName.test(folderName)) {
			return Promise.resolve(self.getUploadsFolders());
		}

		return fs.ensureDirAsync(path.join(self._uploadsPath, folderName)).then(() => {
			if(!_.includes(self._uploadsFolders, folderName)) {
				self._uploadsFolders.push(folderName);
				self._uploadsFolders = _.sortBy(self._uploadsFolders);
			}
			return self.getUploadsFolders();
		});

	},

	/**
	 * Check if folder is valid and exists
	 *
	 * @param      {String}  folderName  The folder name
	 * @return     {Boolean}   True if valid
	 */
	validateUploadsFolder(folderName) {

		if(_.includes(this._uploadsFolders, folderName)) {
			return path.resolve(this._uploadsPath, folderName);
		} else {
			return false;
		}

	},

	/**
	 * Sets the uploads files.
	 *
	 * @param      {Array<Object>}  arrFiles  The uploads files
	 * @return     {Void}  Void
	 */
	setUploadsFiles(arrFiles) {

		let self = this;

		/*if(_.isArray(arrFiles) && arrFiles.length > 0) {
			self._uploadsDb.Files.clear();
			self._uploadsDb.Files.insert(arrFiles);
			self._uploadsDb.Files.ensureIndex('category', true);
			self._uploadsDb.Files.ensureIndex('folder', true);
		}*/

		return;

	},

	/**
	 * Adds one or more uploads files.
	 *
	 * @param      {Array<Object>}  arrFiles  The uploads files
	 * @return     {Void}  Void
	 */
	addUploadsFiles(arrFiles) {
		if(_.isArray(arrFiles) || _.isPlainObject(arrFiles)) {
			//this._uploadsDb.Files.insert(arrFiles);
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

		return /*this._uploadsDb.Files.chain().find({
			'$and': [{ 'category' : cat	},{ 'folder' : fld }]
		}).simplesort('filename').data()*/;

	},

	deleteUploadsFile(fldName, f) {

	}

};