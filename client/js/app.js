'use strict'

/* global $, siteRoot */
/* eslint-disable no-new */

import Vue from 'vue'
import VueResource from 'vue-resource'
import VueClipboards from 'vue-clipboards'
import VueLodash from 'vue-lodash'
import store from './store'
import io from 'socket-io-client'
import i18next from 'i18next'
import i18nextXHR from 'i18next-xhr-backend'
import VueI18Next from '@panter/vue-i18next'
import 'jquery-contextmenu'
import 'jquery-simple-upload'
import 'jquery-smooth-scroll'
import 'jquery-sticky'

// ====================================
// Load minimal lodash
// ====================================

import cloneDeep from 'lodash/cloneDeep'
import concat from 'lodash/concat'
import debounce from 'lodash/debounce'
import deburr from 'lodash/deburr'
import delay from 'lodash/delay'
import filter from 'lodash/filter'
import find from 'lodash/find'
import findKey from 'lodash/findKey'
import forEach from 'lodash/forEach'
import includes from 'lodash/includes'
import isBoolean from 'lodash/isBoolean'
import isEmpty from 'lodash/isEmpty'
import isNil from 'lodash/isNil'
import join from 'lodash/join'
import kebabCase from 'lodash/kebabCase'
import last from 'lodash/last'
import map from 'lodash/map'
import nth from 'lodash/nth'
import pullAt from 'lodash/pullAt'
import reject from 'lodash/reject'
import slice from 'lodash/slice'
import split from 'lodash/split'
import startCase from 'lodash/startCase'
import toString from 'lodash/toString'
import toUpper from 'lodash/toUpper'
import trim from 'lodash/trim'

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
import editorFileComponent from './components/editor-file.vue'
import editorVideoComponent from './components/editor-video.vue'
import historyComponent from './components/history.vue'
import loadingSpinnerComponent from './components/loading-spinner.vue'
import modalCreatePageComponent from './components/modal-create-page.vue'
import modalCreateUserComponent from './components/modal-create-user.vue'
import modalDeleteUserComponent from './components/modal-delete-user.vue'
import modalDiscardPageComponent from './components/modal-discard-page.vue'
import modalMovePageComponent from './components/modal-move-page.vue'
import modalProfile2faComponent from './components/modal-profile-2fa.vue'
import modalUpgradeSystemComponent from './components/modal-upgrade-system.vue'
import pageLoaderComponent from './components/page-loader.vue'
import searchComponent from './components/search.vue'
import toggleComponent from './components/toggle.vue'
import treeComponent from './components/tree.vue'

import adminEditUserComponent from './pages/admin-edit-user.component.js'
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
  isBoolean,
  isEmpty,
  isNil,
  join,
  kebabCase,
  last,
  map,
  nth,
  pullAt,
  reject,
  slice,
  split,
  startCase,
  toString,
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
      loadPath: siteRoot + '/js/i18n/{{lng}}.json'
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
  window.wikijs = new Vue({
    mixins: [helpers],
    components: {
      alert: alertComponent,
      adminEditUser: adminEditUserComponent,
      adminProfile: adminProfileComponent,
      adminSettings: adminSettingsComponent,
      anchor: anchorComponent,
      colorPicker: colorPickerComponent,
      contentView: contentViewComponent,
      editor: editorComponent,
      editorCodeblock: editorCodeblockComponent,
      editorFile: editorFileComponent,
      editorVideo: editorVideoComponent,
      history: historyComponent,
      loadingSpinner: loadingSpinnerComponent,
      modalCreatePage: modalCreatePageComponent,
      modalCreateUser: modalCreateUserComponent,
      modalDeleteUser: modalDeleteUserComponent,
      modalDiscardPage: modalDiscardPageComponent,
      modalMovePage: modalMovePageComponent,
      modalProfile2fa: modalProfile2faComponent,
      modalUpgradeSystem: modalUpgradeSystemComponent,
      pageLoader: pageLoaderComponent,
      search: searchComponent,
      sourceView: sourceViewComponent,
      toggle: toggleComponent,
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
