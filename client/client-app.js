/* global siteConfig */

import Vue from 'vue'
import VueRouter from 'vue-router'
import VueClipboards from 'vue-clipboards'
import { ApolloClient, InMemoryCache, ApolloLink, split } from '@apollo/client/core'
import { BatchHttpLink } from '@apollo/client/link/batch-http'
import { createClient } from 'graphql-ws'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { onError } from '@apollo/client/link/error'
import { getMainDefinition } from '@apollo/client/utilities'
import VueApollo from 'vue-apollo'
import Vuetify from 'vuetify/lib'
import Velocity from 'velocity-animate'
import Vuescroll from 'vuescroll/dist/vuescroll-native'
import Hammer from 'hammerjs'
import moment from 'moment-timezone'
import VueMoment from 'vue-moment'
import store from './store'
import Cookies from 'js-cookie'
import FloatingVue from 'floating-vue'
import VueTour from 'vue-tour'

// ====================================
// Load Modules
// ====================================

import boot from './modules/boot'
import localization from './modules/localization'

// ====================================
// Load Helpers
// ====================================

import helpers from './helpers'
import TourManager from './helpers/tour-manager'

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
const graphQLWSEndpoint = ((window.location.protocol === 'https:') ? 'wss:' : 'ws:') + '//' + window.location.host + '/graphql'

const graphQLLink = ApolloLink.from([
  onError(({ graphQLErrors, networkError }) => {
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
        message: isAuthError ? `You are not authorized to access this resource.` : `An unexpected error occurred.`,
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

const wsClient = createClient({
  url: graphQLWSEndpoint,
  connectionParams: () => {
    const jwtToken = Cookies.get('jwt')
    return jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {}
  }
})

const graphQLWSLink = new GraphQLWsLink(wsClient)
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        history: {
          keyArgs: ['id'],
          merge(existing = {}, incoming, { args }) {
            const existingTrail = existing.trail || []
            const incomingTrail = incoming.trail || []
            const trail = (args && args.offsetPage === 0) ?
              incomingTrail :
              existingTrail.concat(incomingTrail)
            return { ...incoming, trail }
          }
        }
      }
    }
  }
})
window.graphQL = new ApolloClient({
  link: split(({ query }) => {
    const { kind, operation } = getMainDefinition(query)
    return kind === 'OperationDefinition' && operation === 'subscription'
  }, graphQLWSLink, graphQLLink),
  cache: cache,
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

Vue.use(VueTour)
Vue.use(TourManager)

// Override the moment filter to properly handle UTC dates with timezone conversion
Vue.filter('moment', function (value, ...args) {
  if (!value) return ''
  
  const utcDate = moment.utc(value)
  
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const localDate = utcDate.tz(browserTz)
  
  const format = args[0]
  if (format === 'calendar') {
    return localDate.calendar()
  } else if (format === 'from') {
    return localDate.fromNow()
  } else if (format) {
    return localDate.format(format)
  } else {
    return localDate.format()
  }
})

Vue.use(Vuescroll)
Vue.use(FloatingVue)

Vue.prototype.Velocity = Velocity

// ====================================
// Register Vue Components
// ====================================

Vue.component('Admin', () => import(/* webpackChunkName: "admin" */ './components/admin.vue'))
Vue.component('Comments', () => import(/* webpackChunkName: "comments" */ './components/comments.vue'))
Vue.component('Editor', () => import(/* webpackPrefetch: -100, webpackChunkName: "editor" */ './components/editor.vue'))
Vue.component('History', () => import(/* webpackChunkName: "history" */ './components/history.vue'))
Vue.component('Loader', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/loader.vue'))
Vue.component('Login', () => import(/* webpackPrefetch: true, webpackChunkName: "login" */ './components/login.vue'))
Vue.component('NavHeader', () => import(/* webpackMode: "eager" */ './components/common/nav-header.vue'))
Vue.component('NewPage', () => import(/* webpackChunkName: "new-page" */ './components/new-page.vue'))
Vue.component('Notify', () => import(/* webpackMode: "eager" */ './components/common/notify.vue'))
Vue.component('NotFound', () => import(/* webpackChunkName: "not-found" */ './components/not-found.vue'))
Vue.component('PageSelector', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/page-selector.vue'))
Vue.component('PageSource', () => import(/* webpackChunkName: "source" */ './components/source.vue'))
Vue.component('Profile', () => import(/* webpackChunkName: "profile" */ './components/profile.vue'))
Vue.component('Register', () => import(/* webpackChunkName: "register" */ './components/register.vue'))
Vue.component('SearchResults', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/search-results.vue'))
Vue.component('SocialSharing', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/social-sharing.vue'))
Vue.component('Tags', () => import(/* webpackChunkName: "tags" */ './components/tags.vue'))
Vue.component('Unauthorized', () => import(/* webpackChunkName: "unauthorized" */ './components/unauthorized.vue'))
Vue.component('VCardChin', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/v-card-chin.vue'))
Vue.component('VCardInfo', () => import(/* webpackPrefetch: true, webpackChunkName: "ui-extra" */ './components/common/v-card-info.vue'))
Vue.component('Welcome', () => import(/* webpackChunkName: "welcome" */ './components/welcome.vue'))

Vue.component('NavFooter', () => import(/* webpackChunkName: "theme" */ './themes/' + siteConfig.theme + '/components/nav-footer.vue'))
Vue.component('Page', () => import(/* webpackChunkName: "theme" */ './themes/' + siteConfig.theme + '/components/page.vue'))

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

  let darkModeEnabled = siteConfig.darkMode
  if ((store.get('user/appearance') || '').length > 0) {
    darkModeEnabled = (store.get('user/appearance') === 'dark')
  }

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
        dark: darkModeEnabled
      }
    }),
    mounted() {
      this.$moment.locale(siteConfig.lang)
      if ((store.get('user/dateFormat') || '').length > 0) {
        this.$moment.updateLocale(this.$moment.locale(), {
          longDateFormat: {
            'L': store.get('user/dateFormat')
          }
        })
      }
      if ((store.get('user/timezone') || '').length > 0) {
        this.$moment.tz.setDefault(store.get('user/timezone'))
      }
    }
  })

  // ----------------------------------
  // Dispatch boot ready
  // ----------------------------------

  window.boot.notify('vue')
}

window.boot.onDOMReady(bootstrap)
