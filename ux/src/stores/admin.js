import { defineStore } from 'pinia'
import gql from 'graphql-tag'
import { cloneDeep } from 'lodash-es'

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
      loginsPastDay: 0
    },
    overlay: null,
    overlayOpts: {},
    sites: [],
    locales: [
      { code: 'en', name: 'English' }
    ]
  }),
  getters: {},
  actions: {
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
    },
    async fetchInfo () {
      const resp = await APOLLO_CLIENT.query({
        query: gql`
          query getAdminInfo {
            systemInfo {
              groupsTotal
              usersTotal
            }
          }
        `,
        fetchPolicy: 'network-only'
      })
      this.info.groupsTotal = cloneDeep(resp?.data?.systemInfo.groupsTotal ?? 0)
      this.info.usersTotal = cloneDeep(resp?.data?.systemInfo.usersTotal ?? 0)
    }
  }
})
