import { defineStore } from 'pinia'
import jwtDecode from 'jwt-decode'
import Cookies from 'js-cookie'
import gql from 'graphql-tag'
import { DateTime } from 'luxon'

export const useUserStore = defineStore('user', {
  state: () => ({
    id: '10000000-0000-4000-8000-000000000001',
    email: '',
    name: '',
    hasAvatar: false,
    localeCode: '',
    timezone: '',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: '12h',
    appearance: 'site',
    permissions: [],
    iat: 0,
    exp: null,
    authenticated: false,
    token: '',
    profileLoaded: false
  }),
  getters: {},
  actions: {
    async refreshAuth () {
      const jwtCookie = Cookies.get('jwt')
      if (jwtCookie) {
        try {
          const jwtData = jwtDecode(jwtCookie)
          this.id = jwtData.id
          this.email = jwtData.email
          this.iat = jwtData.iat
          this.exp = DateTime.fromSeconds(jwtData.exp, { zone: 'utc' })
          this.token = jwtCookie
          if (this.exp <= DateTime.utc()) {
            console.info('Token has expired. Attempting renew...')
          } else {
            this.authenticated = true
          }
        } catch (err) {
          console.debug('Invalid JWT. Silent authentication skipped.')
        }
      }
    },
    async refreshProfile () {
      if (!this.authenticated || !this.id) {
        return
      }
      try {
        const respRaw = await APOLLO_CLIENT.query({
          query: gql`
            query refreshProfile (
              $id: UUID!
            ) {
              userById(id: $id) {
                id
                name
                email
                hasAvatar
                meta
                prefs
                lastLoginAt
                groups {
                  id
                  name
                }
              }
            }
          `,
          variables: {
            id: this.id
          }
        })
        const resp = respRaw?.data?.userById
        if (!resp || resp.id !== this.id) {
          throw new Error('Failed to fetch user profile!')
        }
        this.name = resp.name || 'Unknown User'
        this.email = resp.email
        this.hasAvatar = resp.hasAvatar ?? false
        this.location = resp.meta.location || ''
        this.jobTitle = resp.meta.jobTitle || ''
        this.pronouns = resp.meta.pronouns || ''
        this.timezone = resp.prefs.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || ''
        this.dateFormat = resp.prefs.dateFormat || ''
        this.timeFormat = resp.prefs.timeFormat || '12h'
        this.appearance = resp.prefs.appearance || 'site'
        this.profileLoaded = true
      } catch (err) {
        console.warn(err)
      }
    }
  }
})
