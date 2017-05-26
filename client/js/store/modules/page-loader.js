'use strict'

export default {
  namespaced: true,
  state: {
    shown: true,
    msg: 'Loading...'
  },
  getters: {},
  mutations: {
    shownChange: (state, shownState) => { state.shown = shownState },
    msgChange: (state, newText) => { state.msg = newText }
  },
  actions: {
    complete({ commit }) { commit('shownChange', false) }
  }
}
