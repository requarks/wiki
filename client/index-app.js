require('core-js/stable')
require('regenerator-runtime/runtime')

require('vuetify/src/stylus/main.styl')
require('./scss/app.scss')
require('./themes/' + process.env.CURRENT_THEME + '/scss/app.scss')

require('./helpers/compatibility.js')
require('./client-app.js')
require('./themes/' + process.env.CURRENT_THEME + '/js/app.js')
