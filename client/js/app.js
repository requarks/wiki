'use strict'

/* global siteLang */
/* eslint-disable no-new */

import $ from 'jquery'
import Vue from 'vue'
import VueResource from 'vue-resource'
import VueClipboards from 'vue-clipboards'
import VueLodash from 'vue-lodash'
import store from './store'
import io from 'socket-io-client'
import i18next from 'i18next'
import i18nextXHR from 'i18next-xhr-backend'
import VueI18Next from '@panter/vue-i18next'
import 'jquery-smooth-scroll'
import 'jquery-sticky'

// ====================================
// Load minimal lodash
// ====================================

import concat from 'lodash/concat'
import cloneDeep from 'lodash/cloneDeep'
import debounce from 'lodash/debounce'
import deburr from 'lodash/deburr'
import delay from 'lodash/delay'
import filter from 'lodash/filter'
import find from 'lodash/find'
import findKey from 'lodash/findKey'
import forEach from 'lodash/forEach'
import includes from 'lodash/includes'
import isEmpty from 'lodash/isEmpty'
import isNil from 'lodash/isNil'
import join from 'lodash/join'
import kebabCase from 'lodash/kebabCase'
import last from 'lodash/last'
import map from 'lodash/map'
import pullAt from 'lodash/pullAt'
import reject from 'lodash/reject'
import slice from 'lodash/slice'
import split from 'lodash/split'
import trim from 'lodash/trim'
import toUpper from 'lodash/toUpper'

// ====================================
// Load Helpers
// ====================================

import helpers from './helpers'

// ====================================
// Load Vue Components
// ====================================

import alertComponent from './components/alert.vue'
import anchorComponent from './components/anchor.vue'
import colorPickerComponent from './components/color-picker.vue'
import editorCodeblockComponent from './components/editor-codeblock.vue'
import loadingSpinnerComponent from './components/loading-spinner.vue'
import modalCreatePageComponent from './components/modal-create-page.vue'
import modalCreateUserComponent from './components/modal-create-user.vue'
import modalDiscardPageComponent from './components/modal-discard-page.vue'
import modalMovePageComponent from './components/modal-move-page.vue'
import pageLoaderComponent from './components/page-loader.vue'
import searchComponent from './components/search.vue'
import treeComponent from './components/tree.vue'

import adminProfileComponent from './pages/admin-profile.component.js'
import adminSettingsComponent from './pages/admin-settings.component.js'
import contentViewComponent from './pages/content-view.component.js'
import editorComponent from './components/editor.component.js'
import sourceViewComponent from './pages/source-view.component.js'

// ====================================
// Build lodash object
// ====================================

const _ = {
  deburr,
  concat,
  cloneDeep,
  debounce,
  delay,
  filter,
  find,
  findKey,
  forEach,
  includes,
  isEmpty,
  isNil,
  join,
  kebabCase,
  last,
  map,
  pullAt,
  reject,
  slice,
  split,
  toUpper,
  trim
}

// ====================================
// Initialize Vue Modules
// ====================================

Vue.use(VueResource)
Vue.use(VueClipboards)
Vue.use(VueI18Next)
Vue.use(VueLodash, _)
Vue.use(helpers)

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
    mixins: [helpers],
    components: {
      alert: alertComponent,
      adminProfile: adminProfileComponent,
      adminSettings: adminSettingsComponent,
      anchor: anchorComponent,
      colorPicker: colorPickerComponent,
      contentView: contentViewComponent,
      editor: editorComponent,
      editorCodeblock: editorCodeblockComponent,
      loadingSpinner: loadingSpinnerComponent,
      modalCreatePage: modalCreatePageComponent,
      modalCreateUser: modalCreateUserComponent,
      modalDiscardPage: modalDiscardPageComponent,
      modalMovePage: modalMovePageComponent,
      pageLoader: pageLoaderComponent,
      search: searchComponent,
      sourceView: sourceViewComponent,
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
