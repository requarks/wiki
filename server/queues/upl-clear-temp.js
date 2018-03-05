'use strict'

/* global WIKI */

const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs-extra'))
const moment = require('moment')
const path = require('path')

module.exports = (job) => {
  return fs.readdirAsync(WIKI.UPLTEMPPATH).then((ls) => {
    let fifteenAgo = moment().subtract(15, 'minutes')

    return Promise.map(ls, (f) => {
      return fs.statAsync(path.join(WIKI.UPLTEMPPATH, f)).then((s) => { return { filename: f, stat: s } })
    }).filter((s) => { return s.stat.isFile() }).then((arrFiles) => {
      return Promise.map(arrFiles, (f) => {
        if (moment(f.stat.ctime).isBefore(fifteenAgo, 'minute')) {
          return fs.unlinkAsync(path.join(WIKI.UPLTEMPPATH, f.filename))
        } else {
          return true
        }
      })
    })
  }).then(() => {
    WIKI.logger.info('Purging temporary upload files: DONE')
    return true
  })
}
