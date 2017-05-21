'use strict'

import _ from 'lodash'

export default {
  state: {
    shown: false,
    style: 'green',
    icon: 'check',
    msg: ''
  },
  getters: {},
  mutations: {
    alertChange: (state, opts) => {
      state.shown = (opts.shown === true)
      state.style = opts.style || 'green'
      state.icon = opts.icon || 'check'
      state.msg = opts.msg || ''
    }
  },
  actions: {
    alert({ commit, dispatch }, opts) {
      opts.shown = true
      commit('alertChange', opts)
      dispatch('alertDismiss')
    },
    alertDismiss: _.debounce(({ commit }) => {
      let opts = { shown: false }
      commit('alertChange', opts)
    }, 3000)
  }
}
