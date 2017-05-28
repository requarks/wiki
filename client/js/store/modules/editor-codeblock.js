'use strict'

export default {
  namespaced: true,
  state: {
    shown: false,
    content: ''
  },
  getters: {},
  mutations: {
    shownChange: (state, shownState) => { state.shown = shownState },
    contentChange: (state, newContent) => { state.content = newContent }
  },
  actions: {
    open({ commit }, opts) {
      commit('shownChange', true)
      commit('contentChange', opts.initialContent || '')
      wikijs.$emit('editorCodeblock/init')
    },
    close({ commit }) { commit('shownChange', false) }
  }
}
