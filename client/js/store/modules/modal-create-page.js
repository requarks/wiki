'use strict'

export default {
  namespaced: true,
  state: {
    entrypath: '',
    shown: false,
    invalid: false
  },
  getters: {},
  mutations: {
    shownChange: (state, shownState) => { state.shown = shownState },
    pathChange: (state, newpath) => { state.entrypath = newpath }
  },
  actions: {
    open({ commit }) { commit('shownChange', true) },
    close({ commit }) { commit('shownChange', false) }
  }
}
