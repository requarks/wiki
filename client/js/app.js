'use strict'

/* global siteConfig */

import CONSTANTS from './constants'

import Vue from 'vue'
import VueClipboards from 'vue-clipboards'
import VeeValidate from 'vee-validate'
import { ApolloClient } from 'apollo-client'
import { ApolloLink } from 'apollo-link'
import { createApolloFetch } from 'apollo-fetch'
import { BatchHttpLink } from 'apollo-link-batch-http'
import { InMemoryCache } from 'apollo-cache-inmemory'
import Hammer from 'hammerjs'
import store from './store'

// ====================================
// Load Modules
// ====================================

import boot from './modules/boot'
import localization from './modules/localization'

// ====================================
// Load Helpers
// ====================================

import helpers from './helpers'

// ====================================
// Initialize Global Vars
// ====================================

window.wiki = null
window.boot = boot
window.CONSTANTS = CONSTANTS
window.Hammer = Hammer

// ====================================
// Initialize Apollo Client (GraphQL)
// ====================================

const graphQLEndpoint = window.location.protocol + '//' + window.location.host + siteConfig.path + 'graphql'

const apolloFetch = createApolloFetch({
  uri: graphQLEndpoint,
  constructOptions: (requestOrRequests, options) => ({
    ...options,
    method: 'POST',
    body: JSON.stringify(requestOrRequests),
    credentials: 'include'
  })
})

window.graphQL = new ApolloClient({
  link: ApolloLink.from([
    new ApolloLink((operation, forward) => {
      operation.setContext({
        headers: {
          'Content-Type': 'application/json'
        }
      })

      return forward(operation)
    }),
    new BatchHttpLink({
      fetch: apolloFetch
    })
  ]),
  cache: new InMemoryCache(),
  connectToDevTools: (process.env.node_env === 'development')
})

// ====================================
// Initialize Vue Modules
// ====================================

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

Vue.component('login', () => import(/* webpackMode: "eager" */ './components/login.vue'))
Vue.component('navigator', () => import(/* webpackMode: "eager" */ './components/navigator.vue'))
Vue.component('setup', () => import(/* webpackChunkName: "setup" */ './components/setup.vue'))
Vue.component('toggle', () => import(/* webpackMode: "eager" */ './components/toggle.vue'))

let bootstrap = () => {
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
    el: '#app',
    components: {},
    mixins: [helpers],
    store,
    i18n
  })

  // ----------------------------------
  // Dispatch boot ready
  // ----------------------------------

  window.boot.notify('vue')

  // ====================================
  // Load Icons
  // ====================================

  import(/* webpackChunkName: "icons" */ '../svg/icons.svg').then(icons => {
    document.body.insertAdjacentHTML('beforeend', icons)
  })
}

window.boot.onDOMReady(bootstrap)
