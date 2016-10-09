"use strict";

var path = require('path'),
	Promise = require('bluebird'),
	fs = Promise.promisifyAll(require('fs-extra')),
	readChunk = require('read-chunk'),
	fileType = require('file-type'),
	farmhash = require('farmhash'),
	moment = require('moment'),
	chokidar = require('chokidar'),
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

		self._uploadsPath = path.resolve(ROOTPATH, appconfig.datadir.repo, 'uploads');
		self._uploadsThumbsPath = path.resolve(ROOTPATH, appconfig.datadir.db, 'thumbs');

		return self;

	},

	watch() {

		let self = this;

		self._watcher = chokidar.watch(self._uploadsPath, {
			persistent: true,
			ignoreInitial: true,
			cwd: self._uploadsPath,
			depth: 1,
			awaitWriteFinish: true
		});

		self._watcher.on('add', (p) => {

			let pInfo = lcdata.parseUploadsRelPath(p);
			return self.processFile(pInfo.folder, pInfo.filename).then((mData) => {
				ws.emit('uploadsAddFiles', {
					auth: WSInternalKey,
					content: mData
				});
			}).then(() => {
				return git.commitUploads();
			});

		});

	},

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
					return self.getImageMetadata(fPath).then((mData) => {

						let cacheThumbnailPath = path.parse(path.join(self._uploadsThumbsPath, fUid + '.png'));
						let cacheThumbnailPathStr = path.format(cacheThumbnailPath);

						mData = _.pick(mData, ['format', 'width', 'height', 'density', 'hasAlpha', 'orientation']);
						mData.uid = fUid;
						mData.category = 'image';
						mData.mime = mimeInfo.mime;
						mData.folder = fldName;
						mData.filename = f;
						mData.basename = fPathObj.name;
						mData.filesize = s.size;
						mData.uploadedOn = moment().utc();

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

					})
				}
			}

			// Other Files
			
			return {
				uid: fUid,
				category: 'file',
				mime: mimeInfo.mime,
				folder: fldName,
				filename: f,
				basename: fPathObj.name,
				filesize: s.size,
				uploadedOn: moment().utc()
			};

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