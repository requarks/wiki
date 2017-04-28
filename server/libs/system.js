'use strict'

const Promise = require('bluebird')
const crypto = require('crypto')
const fs = Promise.promisifyAll(require('fs-extra'))
const https = require('follow-redirects').https
const klaw = require('klaw')
const path = require('path')
const pm2 = Promise.promisifyAll(require('pm2'))
const tar = require('tar')
const through2 = require('through2')
const zlib = require('zlib')
const _ = require('lodash')

module.exports = {

  _remoteFile: 'https://github.com/Requarks/wiki/releases/download/{0}/wiki-js.tar.gz',
  _installDir: '',

  /**
   * Install a version of Wiki.js
   *
   * @param {any} targetTag The version to install
   * @returns {Promise} Promise of the operation
   */
  install (targetTag) {
    let self = this

    self._installDir = path.resolve(ROOTPATH, appconfig.paths.data, 'install')

    return fs.ensureDirAsync(self._installDir).then(() => {
      return fs.emptyDirAsync(self._installDir)
    }).then(() => {
      let remoteURL = _.replace(self._remoteFile, '{0}', targetTag)

      return new Promise((resolve, reject) => {
        /**
         * Fetch tarball and extract to temporary folder
         */
        https.get(remoteURL, resp => {
          if (resp.statusCode !== 200) {
            return reject(new Error('Remote file not found'))
          }
          winston.info('[SERVER.System] Install tarball found. Downloading...')

          resp.pipe(zlib.createGunzip())
          .pipe(tar.Extract({ path: self._installDir }))
          .on('error', err => reject(err))
          .on('end', () => {
            winston.info('[SERVER.System] Tarball extracted. Comparing files...')
            /**
             * Replace old files
             */
            klaw(self._installDir)
            .on('error', err => reject(err))
            .on('end', () => {
              winston.info('[SERVER.System] All files were updated successfully.')
              resolve(true)
            })
            .pipe(self.replaceFile())
          })
        })
      })
    }).then(() => {
      winston.info('[SERVER.System] Cleaning install leftovers...')
      return fs.removeAsync(self._installDir).then(() => {
        winston.info('[SERVER.System] Restarting Wiki.js...')
        return pm2.restartAsync('wiki').catch(err => { // eslint-disable-line handle-callback-err
          winston.error('Unable to restart Wiki.js via pm2... Do a manual restart!')
          process.exit()
        })
      })
    }).catch(err => {
      winston.warn(err)
    })
  },

  /**
   * Replace file if different
   */
  replaceFile () {
    let self = this
    return through2.obj((item, enc, next) => {
      if (!item.stats.isDirectory()) {
        self.digestFile(item.path).then(sourceHash => {
          let destFilePath = _.replace(item.path, self._installDir, ROOTPATH)
          return self.digestFile(destFilePath).then(targetHash => {
            if (sourceHash === targetHash) {
              winston.log('verbose', '[SERVER.System] Skipping ' + destFilePath)
              return fs.removeAsync(item.path).then(() => {
                return next() || true
              })
            } else {
              winston.log('verbose', '[SERVER.System] Updating ' + destFilePath + '...')
              return fs.moveAsync(item.path, destFilePath, { overwrite: true }).then(() => {
                return next() || true
              })
            }
          })
        }).catch(err => {
          throw err
        })
      } else {
        next()
      }
    })
  },

  /**
   * Generate the hash of a file
   *
   * @param {String} filePath The absolute path of the file
   * @return {Promise<String>} Promise of the hash result
   */
  digestFile: (filePath) => {
    return new Promise((resolve, reject) => {
      let hash = crypto.createHash('sha1')
      hash.setEncoding('hex')
      fs.createReadStream(filePath)
      .on('error', err => { reject(err) })
      .on('end', () => {
        hash.end()
        resolve(hash.read())
      })
      .pipe(hash)
    }).catch(err => {
      if (err.code === 'ENOENT') {
        return '0'
      } else {
        throw err
      }
    })
  }
}
