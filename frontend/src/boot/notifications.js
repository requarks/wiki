import { watch } from 'vue'

import { useNotificationsStore } from '@/stores/notifications'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

/** How often a visible tab asks, in milliseconds. */
const POLL_INTERVAL = 60_000

/** The least time between two refreshes a navigation may cause, in milliseconds. */
const NAVIGATION_THROTTLE = 15_000

/**
 * When the notification badge is brought up to date.
 *
 * Polling, and deliberately only while somebody can see it: a hundred tabs left open in the
 * background should not be a hundred requests a minute, so the timer runs while the tab is visible
 * and a tab that becomes visible again asks at once. A navigation asks too, at most every fifteen
 * seconds, which is when somebody is most likely to look at the badge.
 *
 * This is the only part that would change if push is added: a socket that says "something changed"
 * calls the same `refresh()`, and the timer here relaxes to a slow safety net while it is open.
 */
export function initializeNotifications(router) {
  const notificationsStore = useNotificationsStore()
  const siteStore = useSiteStore()
  const userStore = useUserStore()

  let timer = null
  let lastRefreshAt = 0

  const refresh = () => {
    lastRefreshAt = Date.now()
    notificationsStore.refresh()
  }

  const stop = () => {
    clearInterval(timer)
    timer = null
  }

  const start = () => {
    stop()
    if (notificationsStore.isActive && document.visibilityState === 'visible') {
      timer = setInterval(refresh, POLL_INTERVAL)
    }
  }

  // -> Signing in or out, or the site config arriving, changes whether there is anything to ask about
  watch(
    () => [userStore.authenticated, userStore.id, siteStore.id, siteStore.features.notifications],
    () => {
      notificationsStore.reset()
      if (notificationsStore.isActive) {
        refresh()
      }
      start()
    }
  )

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (notificationsStore.isActive) {
        refresh()
      }
      start()
    } else {
      stop()
    }
  })

  router.afterEach(() => {
    if (notificationsStore.isActive && Date.now() - lastRefreshAt > NAVIGATION_THROTTLE) {
      refresh()
    }
  })
}
