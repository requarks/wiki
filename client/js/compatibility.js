// =======================================
// Intl polyfill
// =======================================
// Requirement: Safari 9 and below

if (!global.Intl) {
  require('intl')
  require('intl/locale-data/jsonp/en')
  require('intl/locale-data/jsonp/fr')
}

// =======================================
// Promise polyfill
// =======================================
// Requirement: IE 11 and below

if (!window.Promise) {
  window.Promise = require('bluebird')
}

// =======================================
// Array.from polyfill
// =======================================
// Requirement: IE 11 and below

if (!Array.from) {
  require('./polyfills/array-from')
}

// =======================================
// Fetch polyfill
// =======================================
// Requirement: Safari 9 and below, IE 11 and below

if (!window.fetch) {
  require('whatwg-fetch')
}
