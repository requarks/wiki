'use strict'

export default {
  namespaced: true,
  state: {
    shown: false,
    hash: ''
  },
  getters: {},
  mutations: {
    anchorChange: (state, opts) => {
      state.shown = (opts.shown === true)
      state.hash = opts.hash || ''
    }
  },
  actions: {
    open({ commit }, hash) {
      console.info('MIGUEL!')
      commit('anchorChange', { shown: true, hash })
    },
    close({ commit }) {
      commit('anchorChange', { shown: false })
    }
  }
}
