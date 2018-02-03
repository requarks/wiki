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
