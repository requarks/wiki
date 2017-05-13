'use strict'

/* global db, lang, lcdata, upl, winston */

const path = require('path')
const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs-extra'))
const request = require('request')
const url = require('url')
const crypto = require('crypto')
const _ = require('lodash')

var regFolderName = new RegExp('^[a-z0-9][a-z0-9-]*[a-z0-9]$')
const maxDownloadFileSize = 3145728 // 3 MB

/**
 * Uploads
 */
module.exports = {

  _uploadsPath: './repo/uploads',
  _uploadsThumbsPath: './data/thumbs',

  /**
   * Initialize Local Data Storage model
   *
   * @return     {Object}  Uploads model instance
   */
  init () {
    this._uploadsPath = path.resolve(ROOTPATH, appconfig.paths.repo, 'uploads')
    this._uploadsThumbsPath = path.resolve(ROOTPATH, appconfig.paths.data, 'thumbs')

    return this
  },

  /**
   * Gets the thumbnails folder path.
   *
   * @return     {String}  The thumbs path.
   */
  getThumbsPath () {
    return this._uploadsThumbsPath
  },

  /**
   * Gets the uploads folders.
   *
   * @return     {Array<String>}  The uploads folders.
   */
  getUploadsFolders () {
    return db.UplFolder.find({}, 'name').sort('name').exec().then((results) => {
      return (results) ? _.map(results, 'name') : [{ name: '' }]
    })
  },

  /**
   * Creates an uploads folder.
   *
   * @param      {String}  folderName  The folder name
   * @return     {Promise}  Promise of the operation
   */
  createUploadsFolder (folderName) {
    let self = this

    folderName = _.kebabCase(_.trim(folderName))

    if (_.isEmpty(folderName) || !regFolderName.test(folderName)) {
      return Promise.resolve(self.getUploadsFolders())
    }

    return fs.ensureDirAsync(path.join(self._uploadsPath, folderName)).then(() => {
      return db.UplFolder.findOneAndUpdate({
        _id: 'f:' + folderName
      }, {
        name: folderName
      }, {
        upsert: true
      })
    }).then(() => {
      return self.getUploadsFolders()
    })
  },

  /**
   * Check if folder is valid and exists
   *
   * @param      {String}  folderName  The folder name
   * @return     {Boolean}   True if valid
   */
  validateUploadsFolder (folderName) {
    return db.UplFolder.findOne({ name: folderName }).then((f) => {
      return (f) ? path.resolve(this._uploadsPath, folderName) : false
    })
  },

  /**
   * Adds one or more uploads files.
   *
   * @param      {Array<Object>}  arrFiles  The uploads files
   * @return     {Void}  Void
   */
  addUploadsFiles (arrFiles) {
    if (_.isArray(arrFiles) || _.isPlainObject(arrFiles)) {
      // this._uploadsDb.Files.insert(arrFiles);
    }
  },

  /**
   * Gets the uploads files.
   *
   * @param      {String}  cat     Category type
   * @param      {String}  fld     Folder
   * @return     {Array<Object>}  The files matching the query
   */
  getUploadsFiles (cat, fld) {
    return db.UplFile.find({
      category: cat,
      folder: 'f:' + fld
    }).sort('filename').exec()
  },

  /**
   * Deletes an uploads file.
   *
   * @param      {string}   uid     The file unique ID
   * @return     {Promise}  Promise of the operation
   */
  deleteUploadsFile (uid) {
    let self = this

    return db.UplFile.findOneAndRemove({ _id: uid }).then((f) => {
      if (f) {
        return self.deleteUploadsFileTry(f, 0)
      }
      return true
    })
  },

  deleteUploadsFileTry (f, attempt) {
    let self = this

    let fFolder = (f.folder && f.folder !== 'f:') ? f.folder.slice(2) : './'

    return Promise.join(
      fs.removeAsync(path.join(self._uploadsThumbsPath, f._id + '.png')),
      fs.removeAsync(path.resolve(self._uploadsPath, fFolder, f.filename))
    ).catch((err) => {
      if (err.code === 'EBUSY' && attempt < 5) {
        return Promise.delay(100).then(() => {
          return self.deleteUploadsFileTry(f, attempt + 1)
        })
      } else {
        winston.warn('Unable to delete uploads file ' + f.filename + '. File is locked by another process and multiple attempts failed.')
        return true
      }
    })
  },

  /**
   * Downloads a file from url.
   *
   * @param      {String}   fFolder  The folder
   * @param      {String}   fUrl     The full URL
   * @return     {Promise}  Promise of the operation
   */
  downloadFromUrl (fFolder, fUrl) {
    let fUrlObj = url.parse(fUrl)
    let fUrlFilename = _.last(_.split(fUrlObj.pathname, '/'))
    let destFolder = _.chain(fFolder).trim().toLower().value()

    return upl.validateUploadsFolder(destFolder).then((destFolderPath) => {
      if (!destFolderPath) {
        return Promise.reject(new Error(lang.t('errors:invalidfolder')))
      }

      return lcdata.validateUploadsFilename(fUrlFilename, destFolder).then((destFilename) => {
        let destFilePath = path.resolve(destFolderPath, destFilename)

        return new Promise((resolve, reject) => {
          let rq = request({
            url: fUrl,
            method: 'GET',
            followRedirect: true,
            maxRedirects: 5,
            timeout: 10000
          })

          let destFileStream = fs.createWriteStream(destFilePath)
          let curFileSize = 0

          rq.on('data', (data) => {
            curFileSize += data.length
            if (curFileSize > maxDownloadFileSize) {
              rq.abort()
              destFileStream.destroy()
              fs.remove(destFilePath)
              reject(new Error(lang.t('errors:remotetoolarge')))
            }
          }).on('error', (err) => {
            destFileStream.destroy()
            fs.remove(destFilePath)
            reject(err)
          })

          destFileStream.on('finish', () => {
            resolve(true)
          })

          rq.pipe(destFileStream)
        })
      })
    })
  },

  /**
   * Move/Rename a file
   *
   * @param      {String}   uid        The file ID
   * @param      {String}   fld        The destination folder
   * @param      {String}   nFilename  The new filename (optional)
   * @return     {Promise}  Promise of the operation
   */
  moveUploadsFile (uid, fld, nFilename) {
    let self = this

    return db.UplFolder.findById('f:' + fld).then((folder) => {
      if (folder) {
        return db.UplFile.findById(uid).then((originFile) => {
          // -> Check if rename is valid

          let nameCheck = null
          if (nFilename) {
            let originFileObj = path.parse(originFile.filename)
            nameCheck = lcdata.validateUploadsFilename(nFilename + originFileObj.ext, folder.name)
          } else {
            nameCheck = Promise.resolve(originFile.filename)
          }

          return nameCheck.then((destFilename) => {
            let originFolder = (originFile.folder && originFile.folder !== 'f:') ? originFile.folder.slice(2) : './'
            let sourceFilePath = path.resolve(self._uploadsPath, originFolder, originFile.filename)
            let destFilePath = path.resolve(self._uploadsPath, folder.name, destFilename)
            let preMoveOps = []

            // -> Check for invalid operations

            if (sourceFilePath === destFilePath) {
              return Promise.reject(new Error(lang.t('errors:invalidoperation')))
            }

            // -> Delete DB entry

            preMoveOps.push(db.UplFile.findByIdAndRemove(uid))

            // -> Move thumbnail ahead to avoid re-generation

            if (originFile.category === 'image') {
              let fUid = crypto.createHash('md5').update(folder.name + '/' + destFilename).digest('hex')
              let sourceThumbPath = path.resolve(self._uploadsThumbsPath, originFile._id + '.png')
              let destThumbPath = path.resolve(self._uploadsThumbsPath, fUid + '.png')
              preMoveOps.push(fs.moveAsync(sourceThumbPath, destThumbPath))
            } else {
              preMoveOps.push(Promise.resolve(true))
            }

            // -> Proceed to move actual file

            return Promise.all(preMoveOps).then(() => {
              return fs.moveAsync(sourceFilePath, destFilePath, {
                clobber: false
              })
            })
          })
        })
      } else {
        return Promise.reject(new Error(lang.t('errors:invaliddestfolder')))
      }
    })
  }

}
