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
// Load Helpers
// ====================================

import helpers from './helpers'
import _ from './helpers/lodash'

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
import adminThemeComponent from './pages/admin-theme.component.js'
import contentViewComponent from './pages/content-view.component.js'
import editorComponent from './components/editor.component.js'
import sourceViewComponent from './pages/source-view.component.js'

// ====================================
// Initialize Vue Modules
// ====================================

Vue.use(VueResource)
Vue.use(VueClipboards)
Vue.use(VueI18Next)
Vue.use(VueLodash, _)
Vue.use(helpers)

// ====================================
// Register Vue Components
// ====================================

Vue.component('alert', alertComponent)
Vue.component('adminEditUser', adminEditUserComponent)
Vue.component('adminProfile', adminProfileComponent)
Vue.component('adminSettings', adminSettingsComponent)
Vue.component('adminTheme', adminThemeComponent)
Vue.component('anchor', anchorComponent)
Vue.component('colorPicker', colorPickerComponent)
Vue.component('contentView', contentViewComponent)
Vue.component('editor', editorComponent)
Vue.component('editorCodeblock', editorCodeblockComponent)
Vue.component('editorFile', editorFileComponent)
Vue.component('editorVideo', editorVideoComponent)
Vue.component('history', historyComponent)
Vue.component('loadingSpinner', loadingSpinnerComponent)
Vue.component('modalCreatePage', modalCreatePageComponent)
Vue.component('modalCreateUser', modalCreateUserComponent)
Vue.component('modalDeleteUser', modalDeleteUserComponent)
Vue.component('modalDiscardPage', modalDiscardPageComponent)
Vue.component('modalMovePage', modalMovePageComponent)
Vue.component('modalProfile2fa', modalProfile2faComponent)
Vue.component('modalUpgradeSystem', modalUpgradeSystemComponent)
Vue.component('pageLoader', pageLoaderComponent)
Vue.component('search', searchComponent)
Vue.component('sourceView', sourceViewComponent)
Vue.component('toggle', toggleComponent)
Vue.component('tree', treeComponent)

// ====================================
// Load Localization strings
// ====================================

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
    components: {},
    store,
    i18n,
    el: '#root',
    methods: {
      changeTheme(opts) {
        this.$el.className = `has-stickynav is-primary-${opts.primary} is-alternate-${opts.alt}`
        this.$refs.header.className = `nav is-${opts.primary}`
        this.$refs.footer.className = `footer is-${opts.footer}`
      }
    },
    mounted() {
      $('a:not(.toc-anchor)').smoothScroll({ speed: 500, offset: -50 })
      $('#header').sticky({ topSpacing: 0 })
      $('.sidebar-pagecontents').sticky({ topSpacing: 15, bottomSpacing: 75 })
    }
  })
})
