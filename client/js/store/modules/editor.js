'use strict'

export default {
  namespaced: true,
  state: {
    busy: false,
    insertContent: ''
  },
  getters: {},
  mutations: {
    busyChange: (state, busyState) => { state.shown = busyState },
    insertContentChange: (state, newContent) => { state.insertContent = newContent }
  },
  actions: {
    busyStart({ commit }) { commit('busyChange', true) },
    busyStop({ commit }) { commit('busyChange', false) },
    insert({ commit }, content) {
      commit('insertContentChange', content)
      wikijs.$emit('editor/insert')
    }
  }
}
