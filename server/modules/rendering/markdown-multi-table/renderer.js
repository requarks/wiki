const multiTable = require('markdown-it-multimd-table')

module.exports = {
  init (md, conf) {
    md.use(multiTable, {
      multiline: conf.multilineEnabled,
      rowspan: conf.rowspanEnabled,
      headerless: conf.headerlessEnabled
    })
  }
}
