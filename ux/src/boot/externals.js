import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

export function initializeExternals (router, store) {
  if (import.meta.env.SSR) {
    global.WIKI_STATE = {
      page: usePageStore(store),
      site: useSiteStore(store),
      user: useUserStore(store)
    }
    global.WIKI_ROUTER = router
  } else {
    window.WIKI_STATE = {
      page: usePageStore(store),
      site: useSiteStore(store),
      user: useUserStore(store)
    }
    window.WIKI_ROUTER = router
  }
}
