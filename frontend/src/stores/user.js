import { defineStore } from 'pinia'

import { getAccessibleColor } from '@/helpers/accessibility'

import { useSiteStore } from './site'

const pad = (value) => String(value).padStart(2, '0')

/**
 * Render the date part of a moment the way the user asked for it.
 *
 * The stored preference is one of a handful of explicit patterns, or an empty string meaning "whatever
 * this locale does" — which is the only case a formatter can be left to decide on its own.
 */
function formatDatePart (zoned, dateFormat) {
  switch (dateFormat) {
    case 'DD/MM/YYYY':
      return `${pad(zoned.day)}/${pad(zoned.month)}/${zoned.year}`
    case 'DD.MM.YYYY':
      return `${pad(zoned.day)}.${pad(zoned.month)}.${zoned.year}`
    case 'MM/DD/YYYY':
      return `${pad(zoned.month)}/${pad(zoned.day)}/${zoned.year}`
    case 'YYYY-MM-DD':
      return `${zoned.year}-${pad(zoned.month)}-${pad(zoned.day)}`
    case 'YYYY/MM/DD':
      return `${zoned.year}/${pad(zoned.month)}/${pad(zoned.day)}`
    default:
      // -> Numeric parts rather than `dateStyle: 'short'`, which abbreviates the year to two digits
      return zoned.toLocaleString(undefined, { year: 'numeric', month: 'numeric', day: 'numeric' })
  }
}

/**
 * Render the time part. `hourCycle` rather than `hour12: false`, which some locales render as 24:00
 * where they mean 00:00.
 */
function formatTimePart (zoned, timeFormat) {
  return zoned.toLocaleString(
    undefined,
    timeFormat === '24h'
      ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
      : { hour: 'numeric', minute: '2-digit', hour12: true }
  )
}

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
    // -> Luxon format tokens, for the call sites that still format dates with luxon themselves. They
    //    retire with the last of those; `formatDateTime()` no longer goes through them.
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
      let redirect = '/'
      try {
        const resp = await API_CLIENT.post(`sites/${siteStore.id}/auth/logout`).json()
        redirect = resp?.redirect || '/'
      } catch (err) {
        // -> Clear the client either way. Whatever went wrong, someone who clicked Logout must not be
        //    left looking at a page that still says they are signed in.
        console.warn(err)
      }
      this.setToGuest()
      EVENT_BUS.emit('logout', { redirect })
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
        // -> Page permissions are only refetched on the next navigation, so leaving them would keep
        //    edit buttons on screen for a user who is no longer logged in
        pagePermissions: [],
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
    /**
     * Format a moment as this user asked to see it: their date pattern, their 12h/24h choice, and their
     * time zone. Word order comes from the locale, which is why `t` is passed in.
     *
     * @param date A `Temporal.Instant`, a `Date`, or a string one can be parsed from — what the API
     *             returns. Nullable columns like `lastLoginAt` are common, so nothing at all formats as
     *             an empty string rather than blowing up mid-render.
     */
    formatDateTime(t, date) {
      if (!date) {
        return ''
      }
      let instant = date
      if (typeof date === 'string') {
        instant = Temporal.Instant.from(date)
      } else if (date instanceof Date) {
        instant = date.toTemporalInstant()
      }
      // -> A preference set before the zone list changed, or none at all, falls back to this browser's
      //    zone rather than throwing in the middle of a table
      let zoned
      try {
        zoned = instant.toZonedDateTimeISO(this.timezone || Temporal.Now.timeZoneId())
      } catch {
        zoned = instant.toZonedDateTimeISO(Temporal.Now.timeZoneId())
      }
      return t('common.datetime', {
        date: formatDatePart(zoned, this.dateFormat),
        time: formatTimePart(zoned, this.timeFormat)
      })
    }
  }
})
