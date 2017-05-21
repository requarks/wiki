'use strict'

/* global alertsData, siteLang */
/* eslint-disable no-new */

import $ from 'jquery'
import _ from 'lodash'
import Vue from 'vue'
import Vuex from 'vuex'
import io from 'socket.io-client'
import i18next from 'i18next'
import i18nextXHR from 'i18next-xhr-backend'
import VueI18Next from '@panter/vue-i18next'
import Alerts from './components/alerts.js'
import 'jquery-smooth-scroll'
import 'jquery-sticky'

// ====================================
// Load Vue Components
// ====================================

import anchorComponent from './components/anchor.vue'
import colorPickerComponent from './components/color-picker.vue'
import loadingSpinnerComponent from './components/loading-spinner.vue'
import searchComponent from './components/search.vue'

import adminProfileComponent from './pages/admin-profile.component.js'
import adminSettingsComponent from './pages/admin-settings.component.js'

// ====================================
// Initialize i18next
// ====================================

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

// ====================================
// Initialize Vuex
// ====================================

Vue.use(Vuex)

const store = new Vuex.Store({
  state: {
    loading: false
  },
  mutations: {
    startLoading: state => { state.loading = true },
    stopLoading: state => { state.loading = false }
  }
})

$(() => {
  // ====================================
  // Scroll
  // ====================================

  $('a').smoothScroll({
    speed: 500,
    offset: -50
  })

  $('#header').sticky({ topSpacing: 0 })
  $('.sidebar-pagecontents').sticky({ topSpacing: 15, bottomSpacing: 75 })

  // ====================================
  // Notifications
  // ====================================

  $(window).bind('beforeunload', () => {
    store.commit('startLoading')
  })
  $(document).ajaxSend(() => {
    store.commit('startLoading')
  }).ajaxComplete(() => {
    store.commit('stopLoading')
  })

  var alerts = {}
  /*var alerts = new Alerts()
  if (alertsData) {
    _.forEach(alertsData, (alertRow) => {
      alerts.push(alertRow)
    })
  }*/

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
      adminProfile: adminProfileComponent,
      adminSettings: adminSettingsComponent,
      anchor: anchorComponent,
      colorPicker: colorPickerComponent,
      loadingSpinner: loadingSpinnerComponent,
      search: searchComponent
    },
    store,
    i18n,
    el: '#root'
  })

  // ====================================
  // Pages logic
  // ====================================

  require('./pages/view.js')(alerts)
  require('./pages/all.js')(alerts, socket)
  require('./pages/create.js')(alerts, socket)
  require('./pages/edit.js')(alerts, socket)
  require('./pages/source.js')(alerts)
  require('./pages/history.js')(alerts)
  require('./pages/admin.js')(alerts)
})
