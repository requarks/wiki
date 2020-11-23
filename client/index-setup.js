require('core-js/stable')
require('regenerator-runtime/runtime')

/* eslint-disable no-unused-expressions */

require('./scss/app.scss')
import(/* webpackChunkName: "mdi" */ '@mdi/font/css/materialdesignicons.css')

require('./helpers/compatibility.js')

require('./client-setup.js')
