const mdExpandTabs = require('markdown-it-expand-tabs')
const _ = require('lodash')

// ------------------------------------
// Markdown - Expand Tabs
// ------------------------------------

module.exports = {
  key: 'markdown/expand-tabs',
  title: 'Expand Tabs',
  dependsOn: [],
  props: ['tabWidth'],
  init (md, conf) {
    md.use(mdExpandTabs, {
      tabWidth: _.toInteger(conf.tabWidth || 4)
    })
  }
}
