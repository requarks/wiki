'use strict'

let logic = document.documentElement.dataset.logic

switch (logic) {
  case 'login':
    require('./scss/login.scss')
    require('./js/login.js')
    break
  case 'configure':
    require('./scss/configure.scss')
    require('./js/configure.js')
    break
  default:
    require('./node_modules/highlight.js/styles/tomorrow.css')
    require('./node_modules/simplemde/dist/simplemde.min.css')
    require('./scss/app.scss')
    require('./js/app.js')
    break
}
