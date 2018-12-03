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
    REFRESH_AUTH(state) {
      const jwtCookie = Cookies.get('jwt')
      if (jwtCookie) {
        try {
          const jwtData = jwt.decode(jwtCookie)
          state.id = jwtData.id
          state.email = jwtData.email
          state.name = jwtData.name
          state.pictureUrl = jwtData.pictureUrl
          state.localeCode = jwtData.localeCode
          state.defaultEditor = jwtData.defaultEditor
          state.permissions = jwtData.permissions
          state.iat = jwtData.iat
          state.exp = jwtData.exp
          state.authenticated = true
        } catch (err) {
          console.debug('Invalid JWT. Silent authentication skipped.')
        }
      }
    }
  }
}
