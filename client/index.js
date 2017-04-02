'use strict'

let logic = document.documentElement.dataset.logic

switch (logic) {
  case 'error':
    require('./scss/error.scss')
    break
  case 'login':
    require('./scss/login.scss')
    require('./js/login.js')
    break
  default:
    require('./scss/app.scss')
    require('./js/app.js')
    break
}
