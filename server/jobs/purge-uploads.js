require('../core/worker')

/* global WIKI */

const Promise = require('bluebird')
const fs = Promise.promisifyAll(require('fs-extra'))
const moment = require('moment')
const path = require('path')

module.exports = async (job) => {
  WIKI.logger.info('Purging orphaned upload files...')

  try {
    const uplTempPath = path.resolve(process.cwd(), WIKI.config.paths.data, 'uploads')
    const ls = await fs.readdirAsync(uplTempPath)
    const fifteenAgo = moment().subtract(15, 'minutes')

    await Promise.map(ls, (f) => {
      return fs.statAsync(path.join(uplTempPath, f)).then((s) => { return { filename: f, stat: s } })
    }).filter((s) => { return s.stat.isFile() }).then((arrFiles) => {
      return Promise.map(arrFiles, (f) => {
        if (moment(f.stat.ctime).isBefore(fifteenAgo, 'minute')) {
          return fs.unlinkAsync(path.join(uplTempPath, f.filename))
        }
      })
    })

    WIKI.logger.info('Purging orphaned upload files: [ COMPLETED ]')
  } catch (err) {
    WIKI.logger.error('Purging orphaned upload files: [ FAILED ]')
    WIKI.logger.error(err.message)
  }
}
