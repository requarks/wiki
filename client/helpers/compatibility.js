// =======================================
// Fetch polyfill
// =======================================
// Requirement: Safari 9 and below, IE 11 and below

if (!window.fetch) {
  require('whatwg-fetch')
}
