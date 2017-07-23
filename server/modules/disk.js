'use strict'

/* global wiki */

const path = require('path')
const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs-extra'))
const multer = require('multer')
const os = require('os')
const _ = require('lodash')

/**
 * Local Disk Storage
 */
module.exports = {

  _uploadsPath: './repo/uploads',
  _uploadsThumbsPath: './data/thumbs',

  uploadImgHandler: null,

  /**
   * Initialize Local Data Storage model
   */
  init () {
    this._uploadsPath = path.resolve(wiki.ROOTPATH, wiki.config.paths.repo, 'uploads')
    this._uploadsThumbsPath = path.resolve(wiki.ROOTPATH, wiki.config.paths.data, 'thumbs')

    this.createBaseDirectories()
    this.initMulter()

    return this
  },

  /**
   * Init Multer upload handlers
   */
  initMulter () {
    let maxFileSizes = {
      img: wiki.config.uploads.maxImageFileSize * 1024 * 1024,
      file: wiki.config.uploads.maxOtherFileSize * 1024 * 1024
    }

    // -> IMAGES

    this.uploadImgHandler = multer({
      storage: multer.diskStorage({
        destination: (req, f, cb) => {
          cb(null, path.resolve(wiki.ROOTPATH, wiki.config.paths.data, 'temp-upload'))
        }
      }),
      fileFilter: (req, f, cb) => {
        // -> Check filesize

        if (f.size > maxFileSizes.img) {
          return cb(null, false)
        }

        // -> Check MIME type (quick check only)

        if (!_.includes(['image/png', 'image/jpeg', 'image/gif', 'image/webp'], f.mimetype)) {
          return cb(null, false)
        }

        cb(null, true)
      }
    }).array('imgfile', 20)

    // -> FILES

    this.uploadFileHandler = multer({
      storage: multer.diskStorage({
        destination: (req, f, cb) => {
          cb(null, path.resolve(wiki.ROOTPATH, wiki.config.paths.data, 'temp-upload'))
        }
      }),
      fileFilter: (req, f, cb) => {
        // -> Check filesize

        if (f.size > maxFileSizes.file) {
          return cb(null, false)
        }

        cb(null, true)
      }
    }).array('binfile', 20)

    return true
  },

  /**
   * Creates a base directories (Synchronous).
   */
  createBaseDirectories () {
    wiki.logger.info('Checking data directories...')

    try {
      fs.ensureDirSync(path.resolve(wiki.ROOTPATH, wiki.config.paths.data))
      fs.emptyDirSync(path.resolve(wiki.ROOTPATH, wiki.config.paths.data))
      fs.ensureDirSync(path.resolve(wiki.ROOTPATH, wiki.config.paths.data, './cache'))
      fs.ensureDirSync(path.resolve(wiki.ROOTPATH, wiki.config.paths.data, './thumbs'))
      fs.ensureDirSync(path.resolve(wiki.ROOTPATH, wiki.config.paths.data, './temp-upload'))

      if (os.type() !== 'Windows_NT') {
        fs.chmodSync(path.resolve(wiki.ROOTPATH, wiki.config.paths.data, './temp-upload'), '755')
      }

      fs.ensureDirSync(path.resolve(wiki.ROOTPATH, wiki.config.paths.repo))
      fs.ensureDirSync(path.resolve(wiki.ROOTPATH, wiki.config.paths.repo, './uploads'))

      if (os.type() !== 'Windows_NT') {
        fs.chmodSync(path.resolve(wiki.ROOTPATH, wiki.config.paths.repo, './uploads'), '755')
      }
    } catch (err) {
      wiki.logger.error(err)
    }

    wiki.logger.info('Data and Repository directories are OK.')
  },

  /**
   * Gets the uploads path.
   *
   * @return     {String}  The uploads path.
   */
  getUploadsPath () {
    return this._uploadsPath
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
   * Check if filename is valid and unique
   *
   * @param      {String}           f        The filename
   * @param      {String}           fld      The containing folder
   * @param      {boolean}          isImage  Indicates if image
   * @return     {Promise<String>}  Promise of the accepted filename
   */
  validateUploadsFilename (f, fld, isImage) {
    let fObj = path.parse(f)
    let fname = _.chain(fObj.name).trim().toLower().kebabCase().value().replace(new RegExp('[^a-z0-9-' + wiki.data.regex.cjk + wiki.data.regex.arabic + ']', 'g'), '')
    let fext = _.toLower(fObj.ext)

    if (isImage && !_.includes(['.jpg', '.jpeg', '.png', '.gif', '.webp'], fext)) {
      fext = '.png'
    }

    f = fname + fext
    let fpath = path.resolve(this._uploadsPath, fld, f)

    return fs.statAsync(fpath).then((s) => {
      throw new Error(wiki.lang.t('errors:fileexists', { path: f }))
    }).catch((err) => {
      if (err.code === 'ENOENT') {
        return f
      }
      throw err
    })
  }

}
