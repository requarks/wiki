import { defineStore } from 'pinia'
import { jwtDecode } from 'jwt-decode'
import Cookies from 'js-cookie'

import { DateTime } from 'luxon'
import { getAccessibleColor } from '@/helpers/accessibility'

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
    authenticated: false,
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
    async refreshProfile() {
      try {
        const resp = await API_CLIENT.get('users/whoami', {
          cache: 'no-store'
        }).json()
        if (!resp || !resp.authenticated) {
          this.setToGuest()
        } else {
          this.$patch({
            name: resp.name || 'Unknown User',
            email: resp.email,
            hasAvatar: resp.hasAvatar ?? false,
            location: resp.location || '',
            jobTitle: resp.jobTitle || '',
            pronouns: resp.pronouns || '',
            timezone: resp.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || '',
            dateFormat: resp.dateFormat || '',
            timeFormat: resp.timeFormat || '12h',
            appearance: resp.appearance || 'site',
            cvd: resp.cvd || 'none',
            permissions: resp.permissions || [],
            authenticated: true,
            profileLoaded: true
          })
        }
      } catch (err) {
        console.warn(err)
      }
    },
    async logout() {
      const siteStore = useSiteStore()
      await API_CLIENT.get(`sites/${siteStore.id}/auth/logout`).json()
      this.setToGuest()
      EVENT_BUS.emit('logout')
    },
    setToGuest() {
      this.$patch({
        id: '10000000-0000-4000-8000-000000000001',
        email: '',
        name: '',
        hasAvatar: false,
        timezone: '',
        dateFormat: 'YYYY-MM-DD',
        timeFormat: '12h',
        appearance: 'site',
        cvd: 'none',
        permissions: [],
        authenticated: false,
        profileLoaded: false
      })
    },
    getAccessibleColor(base, hexBase) {
      return getAccessibleColor(base, hexBase, this.cvd)
    },
    can(permission) {
      if (
        this.permissions.includes('manage:system') ||
        this.permissions.includes(permission) ||
        this.pagePermissions.includes(permission)
      ) {
        return true
      }
      return false
    },
    async fetchPagePermissions(path) {
      if (path.startsWith('/_')) {
        this.pagePermissions = []
        return
      }
      const siteStore = useSiteStore()
      try {
        this.pagePermissions = await API_CLIENT.post(
          `sites/${siteStore.id}/pages/userPermissions`,
          {
            json: {
              path
            }
          }
        ).json()
      } catch (err) {
        console.warn(`Failed to fetch page permissions at path ${path}!`)
      }
    },
    formatDateTime(t, date) {
      return (typeof date === 'string' ? DateTime.fromISO(date) : date).toFormat(
        t('common.datetime', { date: this.preferredDateFormat, time: this.preferredTimeFormat })
      )
    }
  }
})
