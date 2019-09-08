import { make } from 'vuex-pathify'
import jwt from 'jsonwebtoken'
import Cookies from 'js-cookie'

const state = {
  id: 0,
  email: '',
  name: '',
  pictureUrl: '',
  localeCode: '',
  defaultEditor: '',
  permissions: [],
  iat: 0,
  exp: 0,
  authenticated: false
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
          st.pictureUrl = jwtData.pictureUrl
          st.localeCode = jwtData.localeCode
          st.defaultEditor = jwtData.defaultEditor
          st.permissions = jwtData.permissions
          st.iat = jwtData.iat
          st.exp = jwtData.exp
          st.authenticated = true
        } catch (err) {
          console.debug('Invalid JWT. Silent authentication skipped.')
        }
      }
    }
  }
}
