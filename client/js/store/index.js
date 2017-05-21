import Vue from 'vue'
import Vuex from 'vuex'

import alert from './modules/alert'
import adminUsersCreate from './modules/admin-users-create'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    loading: false
  },
  mutations: {
    loadingChange: (state, loadingState) => { state.loading = loadingState }
  },
  actions: {
    startLoading({ commit }) { commit('loadingChange', true) },
    stopLoading({ commit }) { commit('loadingChange', false) }
  },
  getters: {},
  modules: {
    alert,
    adminUsersCreate
  }
})
