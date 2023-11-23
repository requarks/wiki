import { defineStore } from 'pinia'
import { jwtDecode } from 'jwt-decode'
import Cookies from 'js-cookie'
import gql from 'graphql-tag'
import { DateTime } from 'luxon'
import { getAccessibleColor } from 'src/helpers/accessibility'

import { useSiteStore } from './site'

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
    cvd: 'none',
    permissions: [],
    pagePermissions: [],
    iat: 0,
    exp: null,
    authenticated: false,
    token: Cookies.get('jwt'),
    profileLoaded: false
  }),
  getters: {
    preferredDateFormat: (state) => {
      if (!state.dateFormat) {
        return 'D'
      } else {
        return state.dateFormat.replaceAll('Y', 'y').replaceAll('D', 'd')
      }
    },
    preferredTimeFormat: (state) => {
      return state.timeFormat === '24h' ? 'T' : 't'
    }
  },
  actions: {
    isTokenValid (offset) {
      return this.exp && this.exp > (offset ? DateTime.now().plus(offset) : DateTime.now())
    },
    loadToken () {
      if (!this.token) { return }
      try {
        const jwtData = jwtDecode(this.token)
        this.id = jwtData.id
        this.email = jwtData.email
        this.iat = jwtData.iat
        this.exp = DateTime.fromSeconds(jwtData.exp, { zone: 'utc' })
        if (this.exp > DateTime.utc()) {
          this.authenticated = true
        } else {
          console.info('Token has expired and will be refreshed on next query.')
        }
      } catch (err) {
        console.warn('Failed to parse JWT. Invalid or malformed.')
      }
    },
    async refreshToken () {
      try {
        const respRaw = await APOLLO_CLIENT.mutate({
          context: {
            skipAuth: true
          },
          mutation: gql`
            mutation refreshToken (
              $token: String!
            ) {
              refreshToken(token: $token) {
                operation {
                  succeeded
                  message
                }
                jwt
              }
            }
          `,
          variables: {
            token: this.token
          }
        })
        const resp = respRaw?.data?.refreshToken ?? {}
        if (!resp.operation?.succeeded) {
          throw new Error(resp.operation?.message || 'Failed to refresh token.')
        }
        Cookies.set('jwt', resp.jwt, { expires: 365, path: '/', sameSite: 'Lax' })
        this.token = resp.jwt
        this.loadToken()
        return true
      } catch (err) {
        console.warn(err)
        return false
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
              userPermissions
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
        this.cvd = resp.prefs.cvd || 'none'
        this.permissions = respRaw.data.userPermissions || []
        this.profileLoaded = true
      } catch (err) {
        console.warn(err)
      }
    },
    logout () {
      Cookies.remove('jwt', { path: '/' })
      this.$patch({
        id: '10000000-0000-4000-8000-000000000001',
        email: '',
        name: '',
        hasAvatar: false,
        localeCode: '',
        timezone: '',
        dateFormat: 'YYYY-MM-DD',
        timeFormat: '12h',
        appearance: 'site',
        cvd: 'none',
        permissions: [],
        iat: 0,
        exp: null,
        authenticated: false,
        token: '',
        profileLoaded: false
      })
      EVENT_BUS.emit('logout')
    },
    getAccessibleColor (base, hexBase) {
      return getAccessibleColor(base, hexBase, this.cvd)
    },
    can (permission) {
      if (this.permissions.includes('manage:system') || this.permissions.includes(permission) || this.pagePermissions.includes(permission)) {
        return true
      }
      return false
    },
    async fetchPagePermissions (path) {
      if (path.startsWith('/_')) {
        this.pagePermissions = []
        return
      }
      const siteStore = useSiteStore()
      try {
        const respRaw = await APOLLO_CLIENT.query({
          query: gql`
            query fetchPagePermissions (
              $siteId: UUID!
              $path: String!
            ) {
              userPermissionsAtPath(
                siteId: $siteId
                path: $path
              )
            }
          `,
          variables: {
            siteId: siteStore.id,
            path
          }
        })
        this.pagePermissions = respRaw?.data?.userPermissionsAtPath || []
      } catch (err) {
        console.warn(`Failed to fetch page permissions at path ${path}!`)
      }
    },
    formatDateTime (t, date) {
      return (typeof date === 'string' ? DateTime.fromISO(date) : date).toFormat(t('common.datetime', { date: this.preferredDateFormat, time: this.preferredTimeFormat }))
    }
  }
})
