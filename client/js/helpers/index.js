'use strict'

const helpers = {
  common: require('./common'),
  form: require('./form'),
  pages: require('./pages')
}

export default {
  install(Vue) {
    Vue.$helpers = helpers
    Object.defineProperties(Vue.prototype, {
      $helpers: {
        get() {
          return helpers
        }
      }
    })
  }
}
