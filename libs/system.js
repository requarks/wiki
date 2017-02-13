'use strict'

const Promise = require('bluebird')
const https = require('follow-redirects').https
const fs = Promise.promisifyAll(require('fs-extra'))
const path = require('path')
const tar = require('tar')
const zlib = require('zlib')
const _ = require('lodash')

module.exports = {

  _remoteFile: 'https://github.com/Requarks/wiki/releases/download/{0}/wiki-js.tar.gz',
  _installDir: '',

  install (targetTag) {
    let self = this

    self._installDir = path.resolve(ROOTPATH, appconfig.paths.data, 'install')

    return fs.ensureDirAsync(self._installDir).then(() => {
      let remoteURL = _.replace(self._remoteFile, '{0}', targetTag)

      return new Promise((resolve, reject) => {
        https.get(remoteURL, resp => {
          if (resp.statusCode !== 200) {
            return reject(new Error('Remote file not found'))
          }

          resp.pipe(zlib.createGunzip())
          .pipe(tar.Extract({ path: self._installDir }))
          .on('error', err => reject(err))
          .on('end', () => {
            resolve(true)
          })
        })
      }).then(() => {

      })
    })
  }
}
