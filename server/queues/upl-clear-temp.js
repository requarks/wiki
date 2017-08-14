'use strict'

/* global wiki */

const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs-extra'))
const moment = require('moment')
const path = require('path')

module.exports = (job) => {
  return fs.readdirAsync(wiki.UPLTEMPPATH).then((ls) => {
    let fifteenAgo = moment().subtract(15, 'minutes')

    return Promise.map(ls, (f) => {
      return fs.statAsync(path.join(wiki.UPLTEMPPATH, f)).then((s) => { return { filename: f, stat: s } })
    }).filter((s) => { return s.stat.isFile() }).then((arrFiles) => {
      return Promise.map(arrFiles, (f) => {
        if (moment(f.stat.ctime).isBefore(fifteenAgo, 'minute')) {
          return fs.unlinkAsync(path.join(wiki.UPLTEMPPATH, f.filename))
        } else {
          return true
        }
      })
    })
  }).then(() => {
    wiki.logger.info('Purging temporary upload files: DONE')
    return true
  })
}
