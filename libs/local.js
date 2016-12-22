"use strict";

var path = require('path'),
	Promise = require('bluebird'),
	fs = Promise.promisifyAll(require('fs-extra')),
	multer  = require('multer'),
	os = require('os'),
	_ = require('lodash');

/**
 * Local Data Storage
 *
 * @param      {Object}  appconfig  The application configuration
 */
module.exports = {

	_uploadsPath: './repo/uploads',
	_uploadsThumbsPath: './data/thumbs',

	uploadImgHandler: null,

	/**
	 * Initialize Local Data Storage model
	 *
	 * @param      {Object}  appconfig  The application config
	 * @return     {Object}  Local Data Storage model instance
	 */
	init(appconfig) {

		this._uploadsPath = path.resolve(ROOTPATH, appconfig.paths.repo, 'uploads');
		this._uploadsThumbsPath = path.resolve(ROOTPATH, appconfig.paths.data, 'thumbs');

		this.createBaseDirectories(appconfig);
		this.initMulter(appconfig);

		return this;

	},

	/**
	 * Init Multer upload handlers
	 *
	 * @param      {Object}   appconfig  The application config
	 * @return     {boolean}  Void
	 */
	initMulter(appconfig) {

		let maxFileSizes = {
			img: appconfig.uploads.maxImageFileSize * 1024 * 1024,
			file: appconfig.uploads.maxOtherFileSize * 1024 * 1024
		};

		//-> IMAGES

		this.uploadImgHandler = multer({
			storage: multer.diskStorage({
				destination: (req, f, cb) => {
					cb(null, path.resolve(ROOTPATH, appconfig.paths.data, 'temp-upload'));
				}
			}),
			fileFilter: (req, f, cb) => {

				//-> Check filesize

				if(f.size > maxFileSizes.img) {
					return cb(null, false);
				}

				//-> Check MIME type (quick check only)

				if(!_.includes(['image/png', 'image/jpeg', 'image/gif', 'image/webp'], f.mimetype)) {
					return cb(null, false);
				}

				cb(null, true);
			}
		}).array('imgfile', 20);

		//-> FILES

		this.uploadFileHandler = multer({
			storage: multer.diskStorage({
				destination: (req, f, cb) => {
					cb(null, path.resolve(ROOTPATH, appconfig.paths.data, 'temp-upload'));
				}
			}),
			fileFilter: (req, f, cb) => {

				//-> Check filesize

				if(f.size > maxFileSizes.file) {
					return cb(null, false);
				}

				cb(null, true);
			}
		}).array('binfile', 20);

		return true;

	},

	/**
	 * Creates a base directories (Synchronous).
	 *
	 * @param      {Object}  appconfig  The application config
	 * @return     {Void}  Void
	 */
	createBaseDirectories(appconfig) {

		winston.info('[SERVER] Checking data directories...');

		try {
			fs.ensureDirSync(path.resolve(ROOTPATH, appconfig.paths.data));
			fs.ensureDirSync(path.resolve(ROOTPATH, appconfig.paths.data, './cache'));
			fs.ensureDirSync(path.resolve(ROOTPATH, appconfig.paths.data, './thumbs'));
			fs.ensureDirSync(path.resolve(ROOTPATH, appconfig.paths.data, './temp-upload'));

			if(os.type() !== 'Windows_NT') {
				fs.chmodSync(path.resolve(ROOTPATH, appconfig.paths.data, './temp-upload'), '644');
			}

			fs.ensureDirSync(path.resolve(ROOTPATH, appconfig.paths.repo));
			fs.ensureDirSync(path.resolve(ROOTPATH, appconfig.paths.repo, './uploads'));

			if(os.type() !== 'Windows_NT') {
				fs.chmodSync(path.resolve(ROOTPATH, appconfig.paths.repo, './upload'), '644');
			}

		} catch (err) {
			winston.error(err);
		}

		winston.info('[SERVER] Data and Repository directories are OK.');

		return;

	},

	/**
	 * Gets the uploads path.
	 *
	 * @return     {String}  The uploads path.
	 */
	getUploadsPath() {
		return this._uploadsPath;
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
	 * Check if filename is valid and unique
	 *
	 * @param      {String}           f       The filename
	 * @param      {String}           fld     The containing folder
	 * @return     {Promise<String>}  Promise of the accepted filename
	 */
	validateUploadsFilename(f, fld, isImage) {

		let fObj = path.parse(f);
		let fname = _.chain(fObj.name).trim().toLower().kebabCase().value().replace(/[^a-z0-9\-]+/g, '');
		let fext = _.toLower(fObj.ext);

		if(isImage && !_.includes(['.jpg', '.jpeg', '.png', '.gif', '.webp'], fext)) {
			fext = '.png';
		}

		f = fname + fext;
		let fpath = path.resolve(this._uploadsPath, fld, f);

		return fs.statAsync(fpath).then((s) => {
			throw new Error('File ' + f + ' already exists.');
		}).catch((err) => {
			if(err.code === 'ENOENT') {
				return f;
			}
			throw err;
		});

	},

};