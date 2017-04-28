'use strict'

module.exports = function (siOptions) {
  var siUtil = {}

  siUtil.countDocs = function (callback) {
    var count = 0
    const gte = 'DOCUMENT' + siOptions.keySeparator
    const lte = 'DOCUMENT' + siOptions.keySeparator + siOptions.keySeparator
    siOptions.indexes.createReadStream({gte: gte, lte: lte})
      .on('data', function (data) {
        count++
      })
      .on('error', function (err) {
        return callback(err, null)
      })
      .on('end', function () {
        return callback(null, count)
      })
  }

  siUtil.close = function (callback) {
    siOptions.indexes.close(function (err) {
      while (!siOptions.indexes.isClosed()) {
        // log not always working here- investigate
        if (siOptions.log) siOptions.log.info('closing...')
      }
      if (siOptions.indexes.isClosed()) {
        if (siOptions.log) siOptions.log.info('closed...')
        callback(err)
      }
    })
  }

  return siUtil
}
