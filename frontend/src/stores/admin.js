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
      isMCPEnabled: false,
      isMailConfigured: false,
      isMetricsEnabled: false,
      isSchedulerHealthy: false
    },
    /**
     * How the current site's storage is behaving, for the status light on the sidebar's Storage item.
     *
     * `degraded` names the targets that are not healthy, so the light can say more than that
     * something is wrong somewhere. Kept here rather than on the storage page because the sidebar
     * outlives it: the point of the light is to be visible from everywhere else in the admin area.
     */
    storageHealth: { status: 'healthy', degraded: [] },
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
      // -> Installed only: everything reading this offers a locale to *use* — the interface language
      //    menu, a group's page rules — and one with no strings downloaded has nothing to offer.
      //    The locale admin page fetches the full list itself, since installing is what it is for.
      this.locales = sortBy(
        cloneDeep(resp ?? []).filter((lc) => lc.isInstalled),
        ['nativeName', 'name']
      )
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
    /**
     * Work out the site's storage health from a list of targets.
     *
     * The one place the rule lives, called both by `fetchStorageStatus` and by the storage page,
     * which has the same target list in front of it already and no reason to ask again for what it
     * just loaded. Both pass the same shape — `isEnabled` and `state.status` — which is why the
     * status endpoint answers with those fields rather than with a verdict of its own.
     */
    applyStorageTargets(targets) {
      const degraded = (targets ?? [])
        .filter((tgt) => tgt.isEnabled && ['warning', 'error'].includes(tgt.state?.status))
        .map((tgt) => ({ id: tgt.id, title: tgt.title, status: tgt.state.status }))
      this.storageHealth = {
        // -> Worst wins: one target that refused an upload is not softened by four that are fine
        status: degraded.some((tgt) => tgt.status === 'error')
          ? 'error'
          : degraded.length > 0
            ? 'warning'
            : 'healthy',
        degraded
      }
    },
    async fetchStorageStatus(siteId) {
      if (!siteId) {
        return
      }
      const resp = await API_CLIENT.get(`sites/${siteId}/storage/status`).json()
      this.applyStorageTargets(resp?.targets ?? [])
    },
    async fetchSites() {
      this.sites = (await API_CLIENT.get('sites').json()) ?? []
      if (!this.currentSiteId) {
        this.currentSiteId = this.sites[0].id
      }
    }
  }
})
