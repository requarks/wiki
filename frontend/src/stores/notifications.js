import { defineStore } from 'pinia'

import { usePageStore } from './page'
import { useSiteStore } from './site'
import { useUserStore } from './user'

/** What reading a page's content counts as having seen. */
const CONTENT_CATEGORIES = ['watchedPage', 'pageCreated']

/** What reading a page's discussion counts as having seen. */
const DISCUSSION_CATEGORIES = ['watchedPageComment', 'commentReply', 'mention']

/**
 * The signed-in reader's notifications on this site: the badge count, and the inbox once it is opened.
 *
 * `refresh()` is the one way the count is brought up to date, and what decides WHEN it is called lives
 * outside this store, in `boot/notifications.js`. That split is the point: today a timer and a few
 * events call it; a push channel added later will only ever say "something changed" and call the same
 * method, so the state a pushed update leaves behind is exactly the state a poll would have — the
 * summary endpoint stays the single source of truth either way.
 */
export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    /** Unread entries, counted by the server no further than 100. */
    unread: 0,
    /** When the inbox last changed, which is how a refresh knows the list it holds is stale. */
    latestAt: null,
    /** The loaded part of the inbox, newest activity first. */
    entries: [],
    /** The cursor of the next page, or null at the end. */
    next: null,
    /** Whether the inbox has been opened, so that a refresh knows there is a list to keep current. */
    listLoaded: false,
    listLoading: false,
    /** Only unread entries in the list. */
    unreadOnly: false
  }),
  getters: {
    /** What the badge says: nothing at zero, `99+` once the count is capped. */
    badge: (state) => (state.unread > 99 ? '99+' : state.unread > 0 ? String(state.unread) : ''),
    /** Whether there is anything to poll for: a signed-in reader, on a site that has notifications. */
    isActive: () => {
      const userStore = useUserStore()
      const siteStore = useSiteStore()
      return Boolean(userStore.authenticated && siteStore.id && siteStore.features.notifications)
    }
  },
  actions: {
    /**
     * Bring the count up to date, and the list too if one is showing and the inbox has moved.
     *
     * The request revalidates against the ETag the server sent last time — the browser does that for
     * a `no-cache` response on its own — so a poll that finds nothing new costs a 304 and no body.
     */
    async refresh() {
      if (!this.isActive) {
        this.reset()
        return
      }
      const siteStore = useSiteStore()
      try {
        const summary = await API_CLIENT.get(`sites/${siteStore.id}/notifications/summary`).json()
        const moved = summary.latestAt !== this.latestAt
        this.unread = summary.unread ?? 0
        this.latestAt = summary.latestAt ?? null
        if (moved && this.listLoaded) {
          await this.loadList()
        }
      } catch (err) {
        // -> A missed poll is not worth interrupting anybody for: the next one tries again
        console.warn(`Could not refresh notifications: ${err.message}`)
      }
    },
    /**
     * Load the inbox from the top, or the next page of it.
     */
    async loadList({ append = false } = {}) {
      const siteStore = useSiteStore()
      if (append && !this.next) {
        return
      }
      this.listLoading = true
      try {
        const resp = await API_CLIENT.get(`sites/${siteStore.id}/notifications`, {
          searchParams: {
            ...(append && this.next ? { cursor: this.next } : {}),
            ...(this.unreadOnly ? { unread: true } : {})
          }
        }).json()
        this.entries = append ? [...this.entries, ...resp.entries] : resp.entries
        this.next = resp.next ?? null
        this.listLoaded = true
      } finally {
        this.listLoading = false
      }
    },
    /**
     * Mark entries read — particular ones, everything about a page, or everything.
     *
     * The list is updated in place rather than reloaded, since what changed is known; the count is
     * asked for again, since the server is what knows it.
     *
     * @param {{ ids?: string[], pageId?: string, categories?: string[] }} filter
     */
    async markRead(filter = {}) {
      const siteStore = useSiteStore()
      await API_CLIENT.put(`sites/${siteStore.id}/notifications/read`, { json: filter })
      const matches = (entry) =>
        (!filter.ids || filter.ids.includes(entry.id)) &&
        (!filter.pageId || entry.pageId === filter.pageId) &&
        (!filter.categories || filter.categories.includes(entry.category))
      for (const entry of this.entries) {
        if (matches(entry)) {
          entry.isRead = true
        }
      }
      await this.refresh()
    },
    /**
     * Mark what the reader has now seen of the page in front of them as read: its content on opening
     * it, its discussion on opening the Talk tab.
     *
     * This is what makes "emailed once, then quiet until read" work without anybody visiting the
     * inbox — reading the page IS reading the notification about it. Nothing is written unless the
     * page came with unread entries of the kind just seen, which is the page payload's
     * `unreadNotifications`, so an ordinary page view costs no request.
     */
    async markSeen({ inDiscussion = false } = {}) {
      const pageStore = usePageStore()
      const unread = pageStore.unreadNotifications ?? []
      const seen = unread.filter(
        (category) =>
          CONTENT_CATEGORIES.includes(category) ||
          (inDiscussion && DISCUSSION_CATEGORIES.includes(category))
      )
      if (!pageStore.id || seen.length < 1 || !this.isActive) {
        return
      }
      // -> Taken off first, so that whatever watches this does not ask a second time
      pageStore.unreadNotifications = unread.filter((category) => !seen.includes(category))
      try {
        await this.markRead({ pageId: pageStore.id, categories: seen })
      } catch (err) {
        console.warn(`Could not mark notifications read: ${err.message}`)
      }
    },
    async dismiss(id) {
      const siteStore = useSiteStore()
      await API_CLIENT.delete(`sites/${siteStore.id}/notifications/${id}`)
      this.entries = this.entries.filter((entry) => entry.id !== id)
      await this.refresh()
    },
    /** Forget everything: a different reader, a different site, or a site without notifications. */
    reset() {
      this.unread = 0
      this.latestAt = null
      this.entries = []
      this.next = null
      this.listLoaded = false
    }
  }
})
