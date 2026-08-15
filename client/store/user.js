import { make } from 'vuex-pathify'
import Cookies from 'js-cookie'
import { applyAuthDocumentClass, getAuthSession } from '../helpers/auth-session'

const defaultState = () => ({
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
  authenticated: false
})

const state = {
  ...defaultState()
}

export default {
  namespaced: true,
  state,
  mutations: {
    ...make.mutations(state),
    REFRESH_AUTH(st) {
      const { authenticated, jwtData, expired } = getAuthSession()

      if (expired) {
        Cookies.remove('jwt')
      }

      applyAuthDocumentClass(authenticated)

      if (!authenticated || !jwtData) {
        Object.assign(st, defaultState())
        return
      }

      st.id = jwtData.id
      st.email = jwtData.email
      st.name = jwtData.name
      st.pictureUrl = jwtData.av
      st.localeCode = jwtData.lc
      st.timezone = jwtData.tz || Intl.DateTimeFormat().resolvedOptions().timeZone || ''
      st.dateFormat = jwtData.df || ''
      st.appearance = jwtData.ap || ''
      st.permissions = Array.isArray(jwtData.permissions) ? jwtData.permissions : []
      st.iat = jwtData.iat
      st.exp = jwtData.exp
      st.authenticated = true
    }
  }
}
