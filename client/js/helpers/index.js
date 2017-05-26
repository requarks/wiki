'use strict'

const helpers = {
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
