import { make } from 'vuex-pathify'

const state = {
  info: {
    currentVersion: 'n/a',
    latestVersion: 'n/a',
    groupsTotal: 0,
    pagesTotal: 0,
    usersTotal: 0
  }
}

export default {
  namespaced: true,
  state,
  mutations: make.mutations(state)
}
