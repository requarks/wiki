import { boot } from 'quasar/wrappers'
import { usePageStore } from 'src/stores/page'
import { useSiteStore } from 'src/stores/site'
import { useUserStore } from 'src/stores/user'

export default boot(({ router }) => {
  if (import.meta.env.SSR) {
    global.WIKI_STATE = {
      page: usePageStore(),
      site: useSiteStore(),
      user: useUserStore()
    }
    global.WIKI_ROUTER = router
  } else {
    window.WIKI_STATE = {
      page: usePageStore(),
      site: useSiteStore(),
      user: useUserStore()
    }
    window.WIKI_ROUTER = router
  }
})
