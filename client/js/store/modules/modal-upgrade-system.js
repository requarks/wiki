'use strict'

export default {
  namespaced: true,
  state: {
    shown: false,
    mode: 'upgrade',
    step: 'confirm'
  },
  getters: {},
  mutations: {
    shownChange: (state, shownState) => { state.shown = shownState },
    modeChange: (state, modeState) => { state.mode = modeState },
    stepChange: (state, stepState) => { state.step = stepState }
  },
  actions: {
    open({ commit }, opts) {
      commit('shownChange', true)
      commit('modeChange', opts.mode)
      commit('stepChange', 'confirm')
    },
    close({ commit }) { commit('shownChange', false) }
  }
}
