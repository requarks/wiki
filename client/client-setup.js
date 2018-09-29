/* eslint-disable import/first */
import Vue from 'vue'
import Vuetify from 'vuetify'
import VeeValidate from 'vee-validate'
import boot from './modules/boot'
/* eslint-enable import/first */

window.WIKI = null
window.boot = boot

Vue.use(Vuetify)
Vue.use(VeeValidate, { events: '' })

Vue.component('setup', () => import(/* webpackMode: "eager" */ './components/setup.vue'))

let bootstrap = () => {
  window.WIKI = new Vue({
    el: '#root'
  })

  // ====================================
  // Load Icons
  // ====================================

  import(/* webpackChunkName: "icons" */ './svg/icons.svg').then(icons => {
    document.body.insertAdjacentHTML('beforeend', icons.default)
  })
}

window.boot.onDOMReady(bootstrap)
