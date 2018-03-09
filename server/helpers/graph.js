const _ = require('lodash')
const Filter = require('scim-query-filter-parser')

module.exports = {
  filter (arr, filterString) {
    const prvFilter = new Filter(_.toString(filterString).replace(/'/g, `"`))
    return arr.filter(prvFilter.test)
  },
  orderBy (arr, orderString) {
    let orderParams = _.zip(orderString.split(',').map(ord => _.trim(ord).split(' ').map(_.trim)))
    return _.orderBy(arr, orderParams[0], orderParams[1])
  }
}
