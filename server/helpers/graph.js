const _ = require('lodash')
const Filter = require('scim-query-filter-parser')

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
  },
  filter (arr, filterString) {
    const prvFilter = new Filter(_.toString(filterString).replace(/'/g, `"`))
    return arr.filter(prvFilter.test)
  },
  orderBy (arr, orderString) {
    let orderParams = _.zip(...orderString.split(',').map(ord => _.trim(ord).split(' ').map(_.trim)))
    return _.orderBy(arr, orderParams[0], orderParams[1])
  }
}
