'use strict'

/* global siteLang */
/* eslint-disable no-new */

import $ from 'jquery'
import Vue from 'vue'
import VueResource from 'vue-resource'
import VueClipboards from 'vue-clipboards'
import store from './store'
import io from 'socket.io-client'
import i18next from 'i18next'
import i18nextXHR from 'i18next-xhr-backend'
import VueI18Next from '@panter/vue-i18next'
import 'jquery-smooth-scroll'
import 'jquery-sticky'

// ====================================
// Load Vue Components
// ====================================

import alertComponent from './components/alert.vue'
import anchorComponent from './components/anchor.vue'
import colorPickerComponent from './components/color-picker.vue'
import loadingSpinnerComponent from './components/loading-spinner.vue'
import searchComponent from './components/search.vue'
import treeComponent from './components/tree.vue'

import adminUsersCreateComponent from './modals/admin-users-create.vue'

import adminProfileComponent from './pages/admin-profile.component.js'
import adminSettingsComponent from './pages/admin-settings.component.js'
import sourceComponent from './pages/source.component.js'

// ====================================
// Initialize Vue Modules
// ====================================

Vue.use(VueResource)
Vue.use(VueClipboards)
Vue.use(VueI18Next)

i18next
  .use(i18nextXHR)
  .init({
    backend: {
      loadPath: '/js/i18n/{{lng}}.json'
    },
    lng: siteLang,
    fallbackLng: siteLang
  })

$(() => {
  // ====================================
  // Notifications
  // ====================================

  $(window).bind('beforeunload', () => {
    store.dispatch('startLoading')
  })
  $(document).ajaxSend(() => {
    store.dispatch('startLoading')
  }).ajaxComplete(() => {
    store.dispatch('stopLoading')
  })

  // ====================================
  // Establish WebSocket connection
  // ====================================

  let socket = io(window.location.origin)
  window.socket = socket

  // ====================================
  // Bootstrap Vue
  // ====================================

  const i18n = new VueI18Next(i18next)
  new Vue({
    components: {
      alert: alertComponent,
      adminProfile: adminProfileComponent,
      adminSettings: adminSettingsComponent,
      adminUsersCreate: adminUsersCreateComponent,
      anchor: anchorComponent,
      colorPicker: colorPickerComponent,
      loadingSpinner: loadingSpinnerComponent,
      search: searchComponent,
      sourceView: sourceComponent,
      tree: treeComponent
    },
    store,
    i18n,
    el: '#root',
    mounted() {
      $('a:not(.toc-anchor)').smoothScroll({ speed: 500, offset: -50 })
      $('#header').sticky({ topSpacing: 0 })
      $('.sidebar-pagecontents').sticky({ topSpacing: 15, bottomSpacing: 75 })
    }
  })
})
