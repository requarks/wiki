import { defineStore } from 'pinia'
import jwtDecode from 'jwt-decode'
import Cookies from 'js-cookie'

export const useUserStore = defineStore('user', {
  state: () => ({
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
  }),
  getters: {},
  actions: {
    refreshAuth () {
      const jwtCookie = Cookies.get('jwt')
      if (jwtCookie) {
        try {
          const jwtData = jwtDecode(jwtCookie)
          this.id = jwtData.id
          this.email = jwtData.email
          this.name = jwtData.name
          this.pictureUrl = jwtData.av
          this.localeCode = jwtData.lc
          this.timezone = jwtData.tz || Intl.DateTimeFormat().resolvedOptions().timeZone || ''
          this.dateFormat = jwtData.df || ''
          this.appearance = jwtData.ap || ''
          // this.defaultEditor = jwtData.defaultEditor
          this.permissions = jwtData.permissions
          this.iat = jwtData.iat
          this.exp = jwtData.exp
          this.authenticated = true
        } catch (err) {
          console.debug('Invalid JWT. Silent authentication skipped.')
        }
      }
    }
  }
})
