'use strict'

export default {
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
    anchorOpen({ commit, dispatch }, hash) {
      commit('anchorChange', { shown: true, hash })
    },
    anchorClose({ commit, dispatch }) {
      commit('anchorChange', { shown: false })
    }
  }
}
