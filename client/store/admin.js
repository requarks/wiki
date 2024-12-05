import { make } from 'vuex-pathify'
import sitesQuery from 'gql/admin/sites/sites-query-list.gql'

const state = {
  info: {
    currentVersion: 'n/a',
    latestVersion: 'n/a',
    groupsTotal: 0,
    pagesTotal: 0,
    usersTotal: 0
  },
  sites: []
}

export default {
  namespaced: true,
  state,
  mutations: {
    ...make.mutations(state),
    SET_SITES(state, sites) {
      state.sites = sites
    }
  },

  actions: {
    async fetchSites({ commit }, { apolloClient }) {
      try {
        const response = await apolloClient.query({
          query: sitesQuery,
          variables: {
            showAdminOnly: false
          },
          fetchPolicy: 'network-only'
        })
        const sites = response.data

        commit('SET_SITES', sites)
        return response
      } catch (error) {
        throw error
      }
    },
    async fetchSitesAsAdmin({ commit }, { apolloClient }) {
      try {
        const response = await apolloClient.query({
          query: sitesQuery,
          variables: {
            showAdminOnly: true
          },
          fetchPolicy: 'network-only'
        })
        const sites = response.data

        commit('SET_SITES', sites)
        return response
      } catch (error) {
        throw error
      }
    }
  }
}
