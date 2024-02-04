import { boot } from 'quasar/wrappers'
import { usePageStore } from 'src/stores/page'
import { useSiteStore } from 'src/stores/site'
import { useUserStore } from 'src/stores/user'

export default boot(({ router, store }) => {
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
})
