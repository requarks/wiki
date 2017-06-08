'use strict'

export default {
  namespaced: true,
  state: {
    shown: false,
    mode: 'image'
  },
  getters: {},
  mutations: {
    shownChange: (state, shownState) => { state.shown = shownState },
    modeChange: (state, modeState) => { state.mode = modeState }
  },
  actions: {
    open({ commit }, opts) {
      commit('shownChange', true)
      commit('modeChange', opts.mode)
      wikijs.$emit('editorFile/init')
    },
    close({ commit }) { commit('shownChange', false) }
  }
}
