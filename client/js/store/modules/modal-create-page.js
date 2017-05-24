'use strict'

export default {
  state: {
    shown: false
  },
  getters: {},
  mutations: {
    shownChange: (state, shownState) => { state.shown = shownState }
  },
  actions: {
    adminUsersCreateOpen({ commit }) { commit('shownChange', true) },
    adminUsersCreateClose({ commit }) { commit('shownChange', false) }
  }
}
