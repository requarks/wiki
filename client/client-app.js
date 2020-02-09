/* global siteConfig */

import Vue from 'vue'
import VueRouter from 'vue-router'
import VueClipboards from 'vue-clipboards'
import { ApolloClient } from 'apollo-client'
import { BatchHttpLink } from 'apollo-link-batch-http'
import { ApolloLink, split } from 'apollo-link'
import { WebSocketLink } from 'apollo-link-ws'
import { ErrorLink } from 'apollo-link-error'
import { InMemoryCache } from 'apollo-cache-inmemory'
import { getMainDefinition } from 'apollo-utilities'
import VueApollo from 'vue-apollo'
import Vuetify from 'vuetify/lib'
import Velocity from 'velocity-animate'
import Vuescroll from 'vuescroll/dist/vuescroll-native'
import Hammer from 'hammerjs'
import moment from 'moment'
import VueMoment from 'vue-moment'
import store from './store'
import Cookies from 'js-cookie'

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

window.WIKI = null
window.boot = boot
window.Hammer = Hammer

moment.locale(siteConfig.lang)

store.commit('user/REFRESH_AUTH')

// ====================================
// Initialize Apollo Client (GraphQL)
// ====================================

const graphQLEndpoint = window.location.protocol + '//' + window.location.host + '/graphql'
const graphQLWSEndpoint = ((window.location.protocol === 'https:') ? 'wss:' : 'ws:') + '//' + window.location.host + '/graphql-subscriptions'

const graphQLLink = ApolloLink.from([
  new ErrorLink(({ graphQLErrors, networkError }) => {
    if (graphQLErrors) {
      let isAuthError = false
      graphQLErrors.map(({ message, locations, path }) => {
        if (message === `Forbidden`) {
          isAuthError = true
        }
        console.error(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`)
      })
      store.commit('showNotification', {
        style: 'red',
        message: isAuthError ? `You are not authorized to access this resource.` : `An unexpected error occured.`,
        icon: 'alert'
      })
    }
    if (networkError) {
      console.error(networkError)
      store.commit('showNotification', {
        style: 'red',
        message: `Network Error: ${networkError.message}`,
        icon: 'alert'
      })
    }
  }),
  new BatchHttpLink({
    includeExtensions: true,
    uri: graphQLEndpoint,
    credentials: 'include',
    fetch: async (uri, options) => {
      // Strip __typename fields from variables
      let body = JSON.parse(options.body)
      body = body.map(bd => {
        return ({
          ...bd,
          variables: JSON.parse(JSON.stringify(bd.variables), (key, value) => { return key === '__typename' ? undefined : value })
        })
      })
      options.body = JSON.stringify(body)

      // Inject authentication token
      const jwtToken = Cookies.get('jwt')
      if (jwtToken) {
        options.headers.Authorization = `Bearer ${jwtToken}`
      }

      const resp = await fetch(uri, options)

      // Handle renewed JWT
      const newJWT = resp.headers.get('new-jwt')
      if (newJWT) {
        Cookies.set('jwt', newJWT, { expires: 365 })
      }
      return resp
    }
  })
])

const graphQLWSLink = new WebSocketLink({
  uri: graphQLWSEndpoint,
  options: {
    reconnect: true,
    lazy: true
  }
})

window.graphQL = new ApolloClient({
  link: split(({ query }) => {
    const { kind, operation } = getMainDefinition(query)
    return kind === 'OperationDefinition' && operation === 'subscription'
  }, graphQLWSLink, graphQLLink),
  cache: new InMemoryCache(),
  connectToDevTools: (process.env.node_env === 'development')
})

// ====================================
// Initialize Vue Modules
// ====================================

Vue.config.productionTip = false

Vue.use(VueRouter)
Vue.use(VueApollo)
Vue.use(VueClipboards)
Vue.use(localization.VueI18Next)
Vue.use(helpers)
Vue.use(Vuetify)
Vue.use(VueMoment, { moment })
Vue.use(Vuescroll)

Vue.prototype.Velocity = Velocity

// ====================================
// Register Vue Components
// ====================================

Vue.component('admin', () => import(/* webpackChunkName: "admin" */ './components/admin.vue'))
Vue.component('editor', () => import(/* webpackPrefetch: -100, webpackChunkName: "editor" */ './components/editor.vue'))
Vue.component('history', () => import(/* webpackChunkName: "history" */ './components/history.vue'))
Vue.component('page-source', () => import(/* webpackChunkName: "source" */ './components/source.vue'))
Vue.component('loader', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/loader.vue'))
Vue.component('login', () => import(/* webpackPrefetch: true, webpackChunkName: "login" */ './components/login.vue'))
Vue.component('nav-header', () => import(/* webpackMode: "eager" */ './components/common/nav-header.vue'))
Vue.component('new-page', () => import(/* webpackChunkName: "new-page" */ './components/new-page.vue'))
Vue.component('notify', () => import(/* webpackMode: "eager" */ './components/common/notify.vue'))
Vue.component('not-found', () => import(/* webpackChunkName: "not-found" */ './components/not-found.vue'))
Vue.component('page-selector', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/page-selector.vue'))
Vue.component('profile', () => import(/* webpackChunkName: "profile" */ './components/profile.vue'))
Vue.component('register', () => import(/* webpackChunkName: "register" */ './components/register.vue'))
Vue.component('search-results', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/search-results.vue'))
Vue.component('social-sharing', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/social-sharing.vue'))
Vue.component('tags', () => import(/* webpackChunkName: "tags" */ './components/tags.vue'))
Vue.component('unauthorized', () => import(/* webpackChunkName: "unauthorized" */ './components/unauthorized.vue'))
Vue.component('v-card-chin', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/v-card-chin.vue'))
Vue.component('welcome', () => import(/* webpackChunkName: "welcome" */ './components/welcome.vue'))

Vue.component('nav-footer', () => import(/* webpackChunkName: "theme-page"  */ './themes/' + process.env.CURRENT_THEME + '/components/nav-footer.vue'))
Vue.component('nav-sidebar', () => import(/* webpackChunkName: "theme-page" */ './themes/' + process.env.CURRENT_THEME + '/components/nav-sidebar.vue'))
Vue.component('page', () => import(/* webpackChunkName: "theme-page" */ './themes/' + process.env.CURRENT_THEME + '/components/page.vue'))

let bootstrap = () => {
  // ====================================
  // Notifications
  // ====================================

  window.addEventListener('beforeunload', () => {
    store.dispatch('startLoading')
  })

  const apolloProvider = new VueApollo({
    defaultClient: window.graphQL
  })

  // ====================================
  // Bootstrap Vue
  // ====================================

  const i18n = localization.init()
  window.WIKI = new Vue({
    el: '#root',
    components: {},
    mixins: [helpers],
    apolloProvider,
    store,
    i18n,
    vuetify: new Vuetify({
      rtl: siteConfig.rtl,
      theme: {
        dark: siteConfig.darkMode
      }
    })
  })

  // ----------------------------------
  // Dispatch boot ready
  // ----------------------------------

  window.boot.notify('vue')

  // ====================================
  // Load theme-specific code
  // ====================================

  import(/* webpackChunkName: "theme-page"  */ './themes/' + process.env.CURRENT_THEME + '/js/app.js')
}

window.boot.onDOMReady(bootstrap)
