"use strict";

var path = require('path'),
	Promise = require('bluebird'),
	fs = Promise.promisifyAll(require('fs-extra')),
	readChunk = require('read-chunk'),
	fileType = require('file-type'),
	farmhash = require('farmhash'),
	moment = require('moment'),
	chokidar = require('chokidar'),
	sharp = require('sharp'),
	_ = require('lodash');

/**
 * Uploads
 *
 * @param      {Object}  appconfig  The application configuration
 */
module.exports = {

	_uploadsPath: './repo/uploads',
	_uploadsThumbsPath: './data/thumbs',

	_watcher: null,

	/**
	 * Initialize Uploads model
	 *
	 * @param      {Object}  appconfig  The application config
	 * @return     {Object}  Uploads model instance
	 */
	init(appconfig) {

		let self = this;

		self._uploadsPath = path.resolve(ROOTPATH, appconfig.paths.repo, 'uploads');
		self._uploadsThumbsPath = path.resolve(ROOTPATH, appconfig.paths.data, 'thumbs');

		// Disable Sharp cache, as it cause file locks issues when deleting uploads.
		sharp.cache(false);

		return self;

	},

	/**
	 * Watch the uploads folder for changes
	 * 
	 * @return     {Void}  Void
	 */
	watch() {

		let self = this;

		self._watcher = chokidar.watch(self._uploadsPath, {
			persistent: true,
			ignoreInitial: true,
			cwd: self._uploadsPath,
			depth: 1,
			awaitWriteFinish: true
		});

		//-> Add new upload file

		self._watcher.on('add', (p) => {

			let pInfo = self.parseUploadsRelPath(p);
			return self.processFile(pInfo.folder, pInfo.filename).then((mData) => {
				return db.UplFile.findByIdAndUpdate(mData._id, mData, { upsert: true });
			}).then(() => {
				return git.commitUploads('Uploaded ' + p);
			});

		});

		//-> Remove upload file

		self._watcher.on('unlink', (p) => {

			let pInfo = self.parseUploadsRelPath(p);
			return git.commitUploads('Deleted/Renamed ' + p);

		});

	},

	/**
	 * Initial Uploads scan
	 *
	 * @return     {Promise<Void>}  Promise of the scan operation
	 */
	initialScan() {

		let self = this;

		return fs.readdirAsync(self._uploadsPath).then((ls) => {

			// Get all folders

			return Promise.map(ls, (f) => {
				return fs.statAsync(path.join(self._uploadsPath, f)).then((s) => { return { filename: f, stat: s }; });
			}).filter((s) => { return s.stat.isDirectory(); }).then((arrDirs) => {

				let folderNames = _.map(arrDirs, 'filename');
				folderNames.unshift('');

				// Add folders to DB

				return db.UplFolder.remove({}).then(() => {
					return db.UplFolder.insertMany(_.map(folderNames, (f) => {
						return {
							_id: 'f:' + f,
							name: f
						};
					}));
				}).then(() => {

					// Travel each directory and scan files

					let allFiles = [];

					return Promise.map(folderNames, (fldName) => {

						let fldPath = path.join(self._uploadsPath, fldName);
						return fs.readdirAsync(fldPath).then((fList) => {
							return Promise.map(fList, (f) => {
								return upl.processFile(fldName, f).then((mData) => {
									if(mData) {
										allFiles.push(mData);
									}
									return true;
								});
							}, {concurrency: 3});
						});
					}, {concurrency: 1}).finally(() => {

						// Add files to DB

						return db.UplFile.remove({}).then(() => {
							if(_.isArray(allFiles) && allFiles.length > 0) {
								return db.UplFile.insertMany(allFiles);
							} else {
								return true;
							}
						});

					});

				});
				
			});

		}).then(() => {

			// Watch for new changes

			return upl.watch();

		});

	},

	/**
	 * Parse relative Uploads path
	 *
	 * @param      {String}  f       Relative Uploads path
	 * @return     {Object}  Parsed path (folder and filename)
	 */
	parseUploadsRelPath(f) {

		let fObj = path.parse(f);
		return {
			folder: fObj.dir,
			filename: fObj.base
		};

	},

	/**
	 * Get metadata from file and generate thumbnails if necessary
	 *
	 * @param      {String}  fldName  The folder name
	 * @param      {String}  f        The filename
	 * @return     {Promise<Object>}  Promise of the file metadata
	 */
	processFile(fldName, f) {

		let self = this;

		let fldPath = path.join(self._uploadsPath, fldName);
		let fPath = path.join(fldPath, f);
		let fPathObj = path.parse(fPath);
		let fUid = farmhash.fingerprint32(fldName + '/' + f);

		return fs.statAsync(fPath).then((s) => {

			if(!s.isFile()) { return false; }

			// Get MIME info

			let mimeInfo = fileType(readChunk.sync(fPath, 0, 262));

			// Images

			if(s.size < 3145728) { // ignore files larger than 3MB
				if(_.includes(['image/png', 'image/jpeg', 'image/gif', 'image/webp'], mimeInfo.mime)) {
					return self.getImageMetadata(fPath).then((mImgData) => {

						let cacheThumbnailPath = path.parse(path.join(self._uploadsThumbsPath, fUid + '.png'));
						let cacheThumbnailPathStr = path.format(cacheThumbnailPath);

						let mData = {
							_id: fUid,
							category: 'image',
							mime: mimeInfo.mime,
							extra: _.pick(mImgData, ['format', 'width', 'height', 'density', 'hasAlpha', 'orientation']),
							folder: 'f:' + fldName,
							filename: f,
							basename: fPathObj.name,
							filesize: s.size
						};

						// Generate thumbnail

						return fs.statAsync(cacheThumbnailPathStr).then((st) => {
							return st.isFile();
						}).catch((err) => {
							return false;
						}).then((thumbExists) => {

							return (thumbExists) ? mData : fs.ensureDirAsync(cacheThumbnailPath.dir).then(() => {
								return self.generateThumbnail(fPath, cacheThumbnailPathStr);
							}).return(mData);

						});

					});
				}
			}

			// Other Files
			
			return {
				_id: fUid,
				category: 'binary',
				mime: mimeInfo.mime,
				folder: fldName,
				filename: f,
				basename: fPathObj.name,
				filesize: s.size
			};

		});

	},

	/**
	 * Generate thumbnail of image
	 *
	 * @param      {String}           sourcePath  The source path
	 * @param      {String}           destPath    The destination path
	 * @return     {Promise<Object>}  Promise returning the resized image info
	 */
	generateThumbnail(sourcePath, destPath) {

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

		return sharp(sourcePath).metadata();

	}

};