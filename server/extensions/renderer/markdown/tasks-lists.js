const mdTaskLists = require('markdown-it-task-lists')

// ------------------------------------
// Markdown - Task Lists
// ------------------------------------

module.exports = {
  key: 'markdown/task-lists',
  title: 'Task Lists',
  dependsOn: [],
  props: [],
  init (md, conf) {
    md.use(mdTaskLists)
  }
}
