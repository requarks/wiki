import Vue from 'vue'
import Vuex from 'vuex'

import navigator from './modules/navigator'

Vue.use(Vuex)

export default new Vuex.Store({
  state: {
    loading: false
  },
  mutations: {
    loadingChange: (state, loadingState) => { state.loading = loadingState }
  },
  actions: {
    alert({ dispatch }, opts) { dispatch('navigator/alert', opts) },
    startLoading({ commit }) { commit('loadingChange', true) },
    stopLoading({ commit }) { commit('loadingChange', false) }
  },
  getters: {},
  modules: {
    navigator
  }
})
