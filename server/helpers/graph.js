const _ = require('lodash')

module.exports = {
  generateSuccess (msg) {
    return {
      succeeded: true,
      errorCode: 0,
      slug: 'ok',
      message: _.defaultTo(msg, 'Operation succeeded.')
    }
  },
  generateError (err, complete = true) {
    const error = {
      succeeded: false,
      errorCode: _.isFinite(err.code) ? err.code : 1,
      slug: err.name,
      message: err.message || 'An unexpected error occured.'
    }
    return (complete) ? { responseResult: error } : error
  }
}
