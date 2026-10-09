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
 * The overlay fetches the terms it lists itself, when it opens. What is held here is what the ARTICLE
 * needs, which outlives any one overlay: the terms linked automatically in page text, once per locale,
 * and the terms a reader has hovered, for the card (`helpers/glossaryLinker.js`, spec §9). Both are
 * dropped by `invalidate`, which the overlay calls after every write so that the page behind it
 * re-links at once.
 */
export const useGlossaryStore = defineStore('glossary', {
  state: () => ({
    /** Whose answer this is -- `siteId:userId` -- so a login, a logout or another site asks again. */
    loadedFor: null,
    enabled: false,
    readableLocales: [],
    /** The locales this session may edit the glossary in -- `manage:glossary`, asked per locale. */
    manageableLocales: [],
    /** Bumped by `invalidate`, which is what a page's links are re-made on. */
    revision: 0
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
      // -> Somebody else may read other terms, or none
      this.invalidate()
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
    },
    /**
     * The terms a page in this locale links automatically. Fetched once per locale and held, and
     * revalidated by the browser with the ETag the server answers with -- so a reload costs a 304
     * rather than the list.
     *
     * An empty list where it cannot be had: a page is better unlinked than broken.
     */
    autoLinkTerms(locale) {
      const siteStore = useSiteStore()
      if (!autoLinkCache.has(locale)) {
        autoLinkCache.set(
          locale,
          API_CLIENT.get(`sites/${siteStore.id}/glossary/autolink`, { searchParams: { locale } })
            .json()
            .catch((err) => {
              console.warn(`Failed to fetch the glossary terms to link: ${err.message}`)
              autoLinkCache.delete(locale)
              return []
            })
        )
      }
      return autoLinkCache.get(locale)
    },
    /**
     * A term in full, for the card shown over a link to it. Held for the session, like the list.
     *
     * @returns {Promise<object|null>} Null for a term that is gone, or not this reader's to read.
     */
    term(id) {
      const siteStore = useSiteStore()
      if (!termCache.has(id)) {
        termCache.set(
          id,
          API_CLIENT.get(`sites/${siteStore.id}/glossary/${id}`)
            .json()
            .catch(() => {
              termCache.delete(id)
              return null
            })
        )
      }
      return termCache.get(id)
    },
    /**
     * The id of the term a name or an alias belongs to, for a link written by hand to a term that is
     * not in the auto-link list -- one with `autoLink` off, or every one where auto-linking is off.
     */
    lookup(locale, name) {
      const siteStore = useSiteStore()
      const key = `${locale}|${name.toLocaleLowerCase(locale)}`
      if (!lookupCache.has(key)) {
        lookupCache.set(
          key,
          API_CLIENT.get(`sites/${siteStore.id}/glossary/lookup`, {
            searchParams: { locale, name }
          })
            .json()
            .then((found) => found?.id ?? null)
            .catch(() => null)
        )
      }
      return lookupCache.get(key)
    },
    /** Forget every term held, after a write or a change of who is asking. */
    invalidate() {
      autoLinkCache.clear()
      termCache.clear()
      lookupCache.clear()
      this.revision++
    }
  }
})

/*
  Promises rather than values, so that a page asking twice while the first request is out makes one
  request -- and outside the store's state, since none of it is anything a component draws.
*/
const autoLinkCache = new Map()
const termCache = new Map()
const lookupCache = new Map()
