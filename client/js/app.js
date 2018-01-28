'use strict'

/* global siteConfig */

import CONSTANTS from './constants'

import Vue from 'vue'
import VueResource from 'vue-resource'
import VueClipboards from 'vue-clipboards'
import VeeValidate from 'vee-validate'
import { ApolloClient } from 'apollo-client'
import { HttpLink } from 'apollo-link-http'
import { InMemoryCache } from 'apollo-cache-inmemory'
import store from './store'

// ====================================
// Load Modules
// ====================================

import localization from './modules/localization'

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
import loginComponent from './components/login.vue'
import modalCreatePageComponent from './components/modal-create-page.vue'
import modalCreateUserComponent from './components/modal-create-user.vue'
import modalDeletePageComponent from './components/modal-delete-page.vue'
import modalDeleteUserComponent from './components/modal-delete-user.vue'
import modalDiscardPageComponent from './components/modal-discard-page.vue'
import modalMovePageComponent from './components/modal-move-page.vue'
import modalProfile2faComponent from './components/modal-profile-2fa.vue'
import modalUpgradeSystemComponent from './components/modal-upgrade-system.vue'
import navigatorComponent from './components/navigator.vue'
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
// Initialize Global Vars
// ====================================

window.wiki = null
window.CONSTANTS = CONSTANTS

// ====================================
// Initialize Apollo Client (GraphQL)
// ====================================

window.graphQL = new ApolloClient({
  link: new HttpLink({
    uri: window.location.protocol + '//' + window.location.host + siteConfig.path + 'graphql'
  }),
  cache: new InMemoryCache(),
  connectToDevTools: (process.env.node_env === 'development')
})

// ====================================
// Initialize Vue Modules
// ====================================

Vue.use(VueResource)
Vue.use(VueClipboards)
Vue.use(localization.VueI18Next)
Vue.use(helpers)
Vue.use(VeeValidate, {
  enableAutoClasses: true,
  classNames: {
    touched: 'is-touched', // the control has been blurred
    untouched: 'is-untouched', // the control hasn't been blurred
    valid: 'is-valid', // model is valid
    invalid: 'is-invalid', // model is invalid
    pristine: 'is-pristine', // control has not been interacted with
    dirty: 'is-dirty' // control has been interacted with
  }
})

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
Vue.component('login', loginComponent)
Vue.component('modalCreatePage', modalCreatePageComponent)
Vue.component('modalCreateUser', modalCreateUserComponent)
Vue.component('modalDeletePage', modalDeletePageComponent)
Vue.component('modalDeleteUser', modalDeleteUserComponent)
Vue.component('modalDiscardPage', modalDiscardPageComponent)
Vue.component('modalMovePage', modalMovePageComponent)
Vue.component('modalProfile2fa', modalProfile2faComponent)
Vue.component('modalUpgradeSystem', modalUpgradeSystemComponent)
Vue.component('navigator', navigatorComponent)
Vue.component('pageLoader', pageLoaderComponent)
Vue.component('search', searchComponent)
Vue.component('setup', () => import(/* webpackChunkName: "setup" */ './components/setup.component.js'))
Vue.component('sourceView', sourceViewComponent)
Vue.component('toggle', toggleComponent)
Vue.component('tree', treeComponent)

document.addEventListener('DOMContentLoaded', ev => {
  // ====================================
  // Notifications
  // ====================================

  window.addEventListener('beforeunload', () => {
    store.dispatch('startLoading')
  })

  // ====================================
  // Bootstrap Vue
  // ====================================

  const i18n = localization.init()
  window.wiki = new Vue({
    mixins: [helpers],
    components: {},
    store,
    i18n,
    el: '#app',
    methods: {
      changeTheme(opts) {
        this.$el.className = `has-stickynav is-primary-${opts.primary} is-alternate-${opts.alt}`
        this.$refs.header.className = `nav is-${opts.primary}`
        this.$refs.footer.className = `footer is-${opts.footer}`
      }
    },
    mounted() {

    }
  })

  // ====================================
  // Load Icons
  // ====================================

  import(/* webpackChunkName: "icons" */ '../svg/icons.svg').then(icons => {
    document.body.insertAdjacentHTML('beforeend', icons)
  })
})
