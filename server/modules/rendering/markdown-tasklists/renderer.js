const mdTaskLists = require('markdown-it-task-lists')

// ------------------------------------
// Markdown - Task Lists
// ------------------------------------

module.exports = {
  init (md, conf) {
    md.use(mdTaskLists, { label: false, labelAfter: false })
  }
}
