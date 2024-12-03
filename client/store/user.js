import { make } from 'vuex-pathify'
import jwt from 'jsonwebtoken'
import Cookies from 'js-cookie'
import sitesQuery from 'gql/admin/sites/sites-query-list.gql'

const state = {
  id: 0,
  email: '',
  name: '',
  pictureUrl: '',
  localeCode: '',
  defaultEditor: '',
  timezone: '',
  dateFormat: '',
  appearance: '',
  permissions: [],
  iat: 0,
  exp: 0,
  authenticated: false,
  sites: []
}

export default {
  namespaced: true,
  state,
  mutations: {
    ...make.mutations(state),
    REFRESH_AUTH(st) {
      const jwtCookie = Cookies.get('jwt')
      if (jwtCookie) {
        try {
          const jwtData = jwt.decode(jwtCookie)
          st.id = jwtData.id
          st.email = jwtData.email
          st.name = jwtData.name
          st.pictureUrl = jwtData.av
          st.localeCode = jwtData.lc
          st.timezone = jwtData.tz || Intl.DateTimeFormat().resolvedOptions().timeZone || ''
          st.dateFormat = jwtData.df || ''
          st.appearance = jwtData.ap || ''
          // st.defaultEditor = jwtData.defaultEditor
          st.permissions = jwtData.permissions
          st.iat = jwtData.iat
          st.exp = jwtData.exp
          st.authenticated = true
        } catch (err) {
          console.debug('Invalid JWT. Silent authentication skipped.')
        }
      }
    },
    SET_SITES(state, sites) {
      state.sites = sites
    }
  },

  actions: {
    async fetchSites({ commit }, { apolloClient }) {
      try {
        const response = await apolloClient.query({
          query: sitesQuery,
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
