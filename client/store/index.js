import _ from 'lodash'
import Vue from 'vue'
import Vuex from 'vuex'
import pathify from 'vuex-pathify' // eslint-disable-line import/no-duplicates
import { make } from 'vuex-pathify' // eslint-disable-line import/no-duplicates

import page from './page'
import site from './site'
import user from './user'

/* global WIKI */

Vue.use(Vuex)

const state = {
  loadingStack: [],
  notification: {
    message: '',
    style: 'primary',
    icon: 'cached',
    isActive: false
  }
}

export default new Vuex.Store({
  strict: process.env.NODE_ENV !== 'production',
  plugins: [
    pathify.plugin
  ],
  state,
  getters: {
    isLoading: state => { return state.loadingStack.length > 0 }
  },
  mutations: {
    ...make.mutations(state),
    loadingStart (st, stackName) {
      st.loadingStack = _.union(st.loadingStack, [stackName])
    },
    loadingStop (st, stackName) {
      st.loadingStack = _.without(st.loadingStack, stackName)
    },
    showNotification (st, opts) {
      st.notification = _.defaults(opts, {
        message: '',
        style: 'primary',
        icon: 'cached',
        isActive: true
      })
    },
    updateNotificationState (st, newState) {
      st.notification.isActive = newState
    },
    pushGraphError (st, err) {
      WIKI.$store.commit('showNotification', {
        style: 'red',
        message: _.get(err, 'graphQLErrors[0].message', err.message),
        icon: 'alert'
      })
    }
  },
  actions: { },
  modules: {
    page,
    site,
    user
  }
})
