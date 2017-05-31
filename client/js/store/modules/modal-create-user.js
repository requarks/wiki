'use strict'

export default {
  namespaced: true,
  state: {
    shown: false
  },
  getters: {},
  mutations: {
    shownChange: (state, shownState) => { state.shown = shownState }
  },
  actions: {
    open({ commit }) {
      commit('shownChange', true)
      wikijs.$emit('modalCreateUser/init')
    },
    close({ commit }) { commit('shownChange', false) }
  }
}
