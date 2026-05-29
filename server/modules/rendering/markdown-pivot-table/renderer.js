const pivotTable = require('markdown-it-pivot-table')

module.exports = {
  init (md) {
    md.use(pivotTable)
  }
}
