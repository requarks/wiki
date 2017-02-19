'use strict'

const ora = require('ora')({ text: 'Initializing...', spinner: 'dots12' }).start()
const Promise = require('bluebird')
const exec = require('child_process').exec
const fs = Promise.promisifyAll(require('fs-extra'))
const https = require('follow-redirects').https
const path = require('path')
const pm2 = Promise.promisifyAll(require('pm2'))
const tar = require('tar')
const zlib = require('zlib')
const _ = require('lodash')

let installDir = path.resolve(__dirname, '../..')

ora.text = 'Looking for running instances...'
pm2.connectAsync().then(() => {
  return pm2.describeAsync('wiki').then(() => {
    ora.text = 'Stopping and deleting process from pm2...'
    return pm2.deleteAsync('wiki')
  }).catch(err => { // eslint-disable-line handle-callback-err
    return true
  })
}).then(() => {
  /**
   * Fetch version from npm package
   */
  return fs.readJsonAsync('package.json').then((packageObj) => {
    let versionGet = _.chain(packageObj.version).split('.').take(4).join('.')
    let remoteURL = _.replace('https://github.com/Requarks/wiki/releases/download/v{0}/wiki-js.tar.gz', '{0}', versionGet)

    return new Promise((resolve, reject) => {
      /**
       * Fetch tarball
       */
      ora.text = 'Looking for latest release...'
      https.get(remoteURL, resp => {
        if (resp.statusCode !== 200) {
          return reject(new Error('Remote file not found'))
        }
        ora.text = 'Install tarball found. Downloading...'

        /**
         * Extract tarball
         */
        resp.pipe(zlib.createGunzip())
        .pipe(tar.Extract({ path: installDir }))
        .on('error', err => reject(err))
        .on('end', () => {
          ora.text = 'Tarball extracted successfully.'
          resolve(true)
        })
      })
    })
  })
}).then(() => {
  return new Promise((resolve, reject) => {
    ora.text = 'Installing Wiki.js npm dependencies...'
    let npmInstallProc = exec('npm install --only=production', {
      cwd: installDir
    })
    npmInstallProc.stdout.pipe(process.stdout)
    npmInstallProc.on('error', err => {
      reject(err)
    })
    .on('exit', () => {
      ora.text = 'Wiki.js npm dependencies installed successfully.'
      resolve(true)
    })
  })
}).then(() => {
  fs.accessAsync(path.join(installDir, 'config.yml')).then(() => {
    /**
     * Upgrade mode
     */
    return new Promise((resolve, reject) => {
      ora.text = 'Upgrade succeeded. Starting Wiki.js...'
      let npmInstallProc = exec('node wiki start', {
        cwd: installDir
      })
      npmInstallProc.stdout.pipe(process.stdout)
      npmInstallProc.on('error', err => {
        reject(err)
      })
      .on('exit', () => {
        ora.succeed('Wiki.js has started. Upgrade completed.')
        resolve(true)
      })
    })
  }).catch(err => {
    /**
     * Install mode
     */
    if (err.code === 'ENOENT') {
      ora.text = 'First-time install, creating a new config.yml...'
      return fs.copyAsync(path.join(installDir, 'config.sample.yml'), path.join(installDir, 'config.yml')).then(() => {
        ora.succeed('Installation succeeded. You can now continue with the configuration steps. Check out https://docs.wiki.requarks.io/install for more info.')
      })
    } else {
      return err
    }
  })
}).catch(err => {
  ora.fail(err)
}).finally(() => {
  pm2.disconnect()
})
