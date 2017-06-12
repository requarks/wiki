'use strict'

export default {
  namespaced: true,
  state: {
    shown: false,
    step: 'confirm'
  },
  getters: {},
  mutations: {
    shownChange: (state, shownState) => { state.shown = shownState },
    stepChange: (state, stepState) => { state.step = stepState }
  },
  actions: {
    open({ commit }, opts) {
      commit('shownChange', true)
      commit('stepChange', 'confirm')
    },
    close({ commit }) { commit('shownChange', false) }
  }
}
