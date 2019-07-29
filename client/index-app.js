require('core-js/stable')
require('regenerator-runtime/runtime')

require('./scss/app.scss')
require('./themes/' + process.env.CURRENT_THEME + '/scss/app.scss')

require('@mdi/font/css/materialdesignicons.css')

require('./helpers/compatibility.js')
require('./client-app.js')
require('./themes/' + process.env.CURRENT_THEME + '/js/app.js')
