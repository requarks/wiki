import { defineStore } from 'pinia'
import gql from 'graphql-tag'
import { clone, cloneDeep, sortBy } from 'lodash-es'
import semverGte from 'semver/functions/gte'

/* global APOLLO_CLIENT */

export const useAdminStore = defineStore('admin', {
  state: () => ({
    currentSiteId: null,
    info: {
      currentVersion: 'n/a',
      latestVersion: 'n/a',
      groupsTotal: 0,
      pagesTotal: 0,
      usersTotal: 0,
      loginsPastDay: 0,
      isApiEnabled: false,
      isMailConfigured: false,
      isSchedulerHealthy: false
    },
    overlay: null,
    overlayOpts: {},
    sites: [],
    locales: [
      { code: 'en', name: 'English' }
    ]
  }),
  getters: {
    isVersionLatest: (state) => {
      if (!state.info.currentVersion || !state.info.latestVersion || state.info.currentVersion === 'n/a' || state.info.latestVersion === 'n/a') {
        return false
      }
      return semverGte(state.info.currentVersion, state.info.latestVersion)
    }
  },
  actions: {
    async fetchLocales () {
      const resp = await APOLLO_CLIENT.query({
        query: gql`
          query getAdminLocales {
            locales {
              code
              language
              name
              nativeName
            }
          }
        `
      })
      this.locales = sortBy(cloneDeep(resp?.data?.locales ?? []), ['nativeName', 'name'])
    },
    async fetchInfo () {
      const resp = await APOLLO_CLIENT.query({
        query: gql`
          query getAdminInfo {
            apiState
            systemInfo {
              groupsTotal
              usersTotal
              currentVersion
              latestVersion
              isMailConfigured
              isSchedulerHealthy
            }
          }
        `,
        fetchPolicy: 'network-only'
      })
      this.info.groupsTotal = clone(resp?.data?.systemInfo?.groupsTotal ?? 0)
      this.info.usersTotal = clone(resp?.data?.systemInfo?.usersTotal ?? 0)
      this.info.currentVersion = clone(resp?.data?.systemInfo?.currentVersion ?? 'n/a')
      this.info.latestVersion = clone(resp?.data?.systemInfo?.latestVersion ?? 'n/a')
      this.info.isApiEnabled = clone(resp?.data?.apiState ?? false)
      this.info.isMailConfigured = clone(resp?.data?.systemInfo?.isMailConfigured ?? false)
      this.info.isSchedulerHealthy = clone(resp?.data?.systemInfo?.isSchedulerHealthy ?? false)
    },
    async fetchSites () {
      const resp = await APOLLO_CLIENT.query({
        query: gql`
          query getSites {
            sites {
              id
              hostname
              isEnabled
              title
            }
          }
        `,
        fetchPolicy: 'network-only'
      })
      this.sites = cloneDeep(resp?.data?.sites ?? [])
      if (!this.currentSiteId) {
        this.currentSiteId = this.sites[0].id
      }
    }
  }
})
