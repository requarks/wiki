'use strict'

// /* global WIKI */

// const Promise = require('bluebird')
// const fs = Promise.promisifyAll(require('fs-extra'))
// const klaw = require('klaw')
// const moment = require('moment')
// const path = require('path')
// const entryHelper = require('../helpers/entry')

module.exports = (job) => {
  return true
  // return WIKI.git.resync().then(() => {
  //   // -> Stream all documents

  //   let cacheJobs = []
  //   let jobCbStreamDocsResolve = null
  //   let jobCbStreamDocs = new Promise((resolve, reject) => {
  //     jobCbStreamDocsResolve = resolve
  //   })

  //   klaw(WIKI.REPOPATH).on('data', function (item) {
  //     if (path.extname(item.path) === '.md' && path.basename(item.path) !== 'README.md') {
  //       let entryPath = entryHelper.parsePath(entryHelper.getEntryPathFromFullPath(item.path))
  //       let cachePath = entryHelper.getCachePath(entryPath)

  //       // -> Purge outdated cache

  //       cacheJobs.push(
  //         fs.statAsync(cachePath).then((st) => {
  //           return moment(st.mtime).isBefore(item.stats.mtime) ? 'expired' : 'active'
  //         }).catch((err) => {
  //           return (err.code !== 'EEXIST') ? err : 'new'
  //         }).then((fileStatus) => {
  //           // -> Delete expired cache file

  //           if (fileStatus === 'expired') {
  //             return fs.unlinkAsync(cachePath).return(fileStatus)
  //           }

  //           return fileStatus
  //         }).then((fileStatus) => {
  //           // -> Update cache and search index

  //           if (fileStatus !== 'active') {
  //             return global.entries.updateCache(entryPath).then(entry => {
  //               process.send({
  //                 action: 'searchAdd',
  //                 content: entry
  //               })
  //               return true
  //             })
  //           }

  //           return true
  //         })
  //       )
  //     }
  //   }).on('end', () => {
  //     jobCbStreamDocsResolve(Promise.all(cacheJobs))
  //   })

  //   return jobCbStreamDocs
  // }).then(() => {
  //   WIKI.logger.info('Git remote repository sync: DONE')
  //   return true
  // })
}
