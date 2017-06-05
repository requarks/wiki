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
    open({ commit }, opts) {
      commit('shownChange', true)
      wikijs.$emit('editorFile/init')
    },
    close({ commit }) { commit('shownChange', false) }
  }
}
