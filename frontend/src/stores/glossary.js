import { defineStore } from 'pinia'

import { useSiteStore } from './site'
import { useUserStore } from './user'

/**
 * What the current session may do with this site's glossary.
 *
 * Asked once per site and session (`glossary/access`) rather than per route, because `read:glossary`
 * does not depend on the page: it is a page permission whose rule's path is ignored, answered per
 * locale. That is also why it is not part of `userStore.pagePermissions`, which is fetched with a page
 * and is empty on every route that is not one -- the Library menu has to know on `/_tags` too.
 *
 * The terms themselves are not held here: the overlay is the only thing that reads them, and it
 * fetches them when it opens.
 */
export const useGlossaryStore = defineStore('glossary', {
  state: () => ({
    /** Whose answer this is -- `siteId:userId` -- so a login, a logout or another site asks again. */
    loadedFor: null,
    enabled: false,
    readableLocales: [],
    /** The locales this session may edit the glossary in -- `manage:glossary`, asked per locale. */
    manageableLocales: []
  }),
  getters: {
    /** Whether there is a glossary this session may open, in any locale. */
    isAvailable: (state) => state.enabled && state.readableLocales.length > 0,
    /** Whether this session may create, edit and delete terms in a locale. */
    canManageIn: (state) => (locale) => state.manageableLocales.includes(locale)
  },
  actions: {
    /**
     * Fetch the access answer, unless it is already the one for this site and this session.
     *
     * A failure leaves the glossary unavailable rather than throwing: the menu row is the only thing
     * waiting on it, and a missing row is the right answer to not knowing.
     */
    async ensureAccess() {
      const siteStore = useSiteStore()
      const userStore = useUserStore()
      if (!siteStore.id) {
        return
      }
      const key = `${siteStore.id}:${userStore.authenticated ? userStore.id : 'guest'}`
      if (this.loadedFor === key) {
        return
      }
      this.loadedFor = key
      try {
        const access = await API_CLIENT.get(`sites/${siteStore.id}/glossary/access`).json()
        // -> Asked again for somebody else while this was in flight: that answer is the one to keep
        if (this.loadedFor !== key) {
          return
        }
        this.$patch({
          enabled: access.enabled,
          readableLocales: access.readableLocales ?? [],
          manageableLocales: access.manageableLocales ?? []
        })
      } catch (err) {
        console.warn(`Failed to fetch glossary access: ${err.message}`)
        if (this.loadedFor === key) {
          this.$patch({
            loadedFor: null,
            enabled: false,
            readableLocales: [],
            manageableLocales: []
          })
        }
      }
    }
  }
})
