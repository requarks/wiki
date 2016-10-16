"use strict";

const path = require('path'),
			Promise = require('bluebird'),
			fs = Promise.promisifyAll(require('fs-extra')),
			multer  = require('multer'),
			request = require('request'),
			url = require('url'),
			_ = require('lodash');

var regFolderName = new RegExp("^[a-z0-9][a-z0-9\-]*[a-z0-9]$");
const maxDownloadFileSize = 3145728; // 3 MB

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
	 * Gets the uploads folders.
	 *
	 * @return     {Array<String>}  The uploads folders.
	 */
	getUploadsFolders() {
		return db.UplFolder.find({}, 'name').sort('name').exec().then((results) => {
			return (results) ? _.map(results, 'name') : [{ name: '' }];
		});
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
			return db.UplFolder.findOneAndUpdate({
				_id: 'f:' + folderName
			}, {
				name: folderName
			}, {
				upsert: true
			});
		}).then(() => {
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

		return db.UplFolder.findOne({ name: folderName }).then((f) => {
			return (f) ? path.resolve(this._uploadsPath, folderName) : false;
		})

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

		return db.UplFile.find({
			category: cat,
			folder: 'f:' + fld
		}).sort('filename').exec();

	},

	/**
	 * Deletes an uploads file.
	 *
	 * @param      {string}   uid     The file unique ID
	 * @return     {Promise}  Promise of the operation
	 */
	deleteUploadsFile(uid) {

		let self = this;

		return db.UplFile.findOneAndRemove({ _id: uid }).then((f) => {
			if(f) {
				return self.deleteUploadsFileTry(f, 0);
			}
			return true;
		})
	},

	deleteUploadsFileTry(f, attempt) {

		let self = this;

		let fFolder = (f.folder && f.folder !== 'f:') ? f.folder.slice(2) : './';

		return Promise.join(
			fs.removeAsync(path.join(self._uploadsThumbsPath, f._id + '.png')),
			fs.removeAsync(path.resolve(self._uploadsPath, fFolder, f.filename))
		).catch((err) => {
			if(err.code === 'EBUSY' && attempt < 5) {
				return Promise.delay(100).then(() => {
					return self.deleteUploadsFileTry(f, attempt + 1);
				})
			} else {
				winston.warn('Unable to delete uploads file ' + f.filename + '. File is locked by another process and multiple attempts failed.');
				return true;
			}
		});

	},

	/**
	 * Downloads a file from url.
	 *
	 * @param      {String}   fFolder  The folder
	 * @param      {String}   fUrl     The full URL
	 * @return     {Promise}  Promise of the operation
	 */
	downloadFromUrl(fFolder, fUrl) {

		let self = this;

		let fUrlObj = url.parse(fUrl);
		let fUrlFilename = _.last(_.split(fUrlObj.pathname, '/'))
		let destFolder = _.chain(fFolder).trim().toLower().value();

		return upl.validateUploadsFolder(destFolder).then((destFolderPath) => {
			
			if(!destFolderPath) {
				return Promise.reject(new Error('Invalid Folder'));
			}

			return lcdata.validateUploadsFilename(fUrlFilename, destFolder).then((destFilename) => {
				
				let destFilePath = path.resolve(destFolderPath, destFilename);

				return new Promise((resolve, reject) => {

					let rq = request({
						url: fUrl,
						method: 'GET',
						followRedirect: true,
						maxRedirects: 5,
						timeout: 10000
					});

					let destFileStream = fs.createWriteStream(destFilePath);
					let curFileSize = 0;

					rq.on('data', (data) => {
						curFileSize += data.length;
						if(curFileSize > maxDownloadFileSize) {
							rq.abort();
							destFileStream.destroy();
							fs.remove(destFilePath);
							reject(new Error('Remote file is too large!'));
						}
					}).on('error', (err) => {
						destFileStream.destroy();
						fs.remove(destFilePath);
						reject(err);
					});

					destFileStream.on('finish', () => {
						resolve(true);
					})

					rq.pipe(destFileStream);

				});

			});

		});

	}

};