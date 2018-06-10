import _ from 'lodash'
import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

export default new Vuex.Store({
  strict: process.env.NODE_ENV !== 'production',
  state: {
    loadingStack: [],
    notification: {
      message: '',
      style: 'primary',
      icon: 'cached',
      isActive: false
    }
  },
  getters: {
    isLoading: state => { return state.loadingStack.length > 0 }
  },
  mutations: {
    loadingStart (state, stackName) {
      state.loadingStack = _.union(state.loadingStack, [stackName])
    },
    loadingStop (state, stackName) {
      state.loadingStack = _.without(state.loadingStack, stackName)
    },
    showNotification (state, opts) {
      state.notification = _.defaults(opts, {
        message: '',
        style: 'primary',
        icon: 'cached',
        isActive: true
      })
    },
    updateNotificationState (state, newState) {
      state.notification.isActive = newState
    }
  },
  actions: { },
  modules: { }
})
