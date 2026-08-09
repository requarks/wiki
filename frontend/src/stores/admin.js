import { defineStore } from 'pinia'

import { sortBy } from 'es-toolkit/array'
import { cloneDeep } from 'es-toolkit/object'
import semverGte from 'semver/functions/gte'

export const useAdminStore = defineStore('admin', {
  state: () => ({
    currentSiteId: null,
    info: {
      currentVersion: 'n/a',
      latestVersion: 'n/a',
      activeWorkers: 0,
      groupsTotal: 0,
      instancesTotal: 0,
      pagesTotal: 0,
      tagsTotal: 0,
      usersTotal: 0,
      webhooksTotal: 0,
      loginsPastDay: 0,
      isApiEnabled: false,
      isMailConfigured: false,
      isMetricsEnabled: false,
      isSchedulerHealthy: false
    },
    overlay: null,
    overlayOpts: {},
    sites: [],
    locales: [{ code: 'en', name: 'English' }]
  }),
  getters: {
    /**
     * `pending` until `fetchInfo` has both versions -- neither `latest` nor `outdated` can be
     * claimed before the server has answered.
     */
    versionStatus: (state) => {
      if (
        !state.info.currentVersion ||
        !state.info.latestVersion ||
        state.info.currentVersion === 'n/a' ||
        state.info.latestVersion === 'n/a'
      ) {
        return 'pending'
      }
      return semverGte(state.info.currentVersion, state.info.latestVersion) ? 'latest' : 'outdated'
    },
    isVersionLatest() {
      return this.versionStatus === 'latest'
    }
  },
  actions: {
    async fetchLocales() {
      const resp = await API_CLIENT.get('locales').json()
      this.locales = sortBy(cloneDeep(resp ?? []), ['nativeName', 'name'])
    },
    async fetchInfo() {
      const resp = await API_CLIENT.get('system/info').json()
      this.info.activeWorkers = resp?.activeWorkers ?? 0
      this.info.groupsTotal = resp?.groupsTotal ?? 0
      this.info.instancesTotal = resp?.instancesTotal ?? 0
      this.info.tagsTotal = resp?.tagsTotal ?? 0
      this.info.usersTotal = resp?.usersTotal ?? 0
      this.info.webhooksTotal = resp?.webhooksTotal ?? 0
      this.info.loginsPastDay = resp?.loginsPastDay ?? 0
      this.info.currentVersion = resp?.currentVersion ?? 'n/a'
      this.info.latestVersion = resp?.latestVersion ?? 'n/a'
      this.info.isApiEnabled = resp?.isApiEnabled ?? false
      this.info.isMetricsEnabled = resp?.isMetricsEnabled ?? false
      this.info.isMailConfigured = resp?.isMailConfigured ?? false
      this.info.isSchedulerHealthy = resp?.isSchedulerHealthy ?? false
    },
    async fetchSites() {
      this.sites = (await API_CLIENT.get('sites').json()) ?? []
      if (!this.currentSiteId) {
        this.currentSiteId = this.sites[0].id
      }
    }
  }
})
