import { boot } from 'quasar/wrappers'
import { useSiteStore } from 'src/stores/site'
import { useUserStore } from 'src/stores/user'

export default boot(() => {
  if (import.meta.env.SSR) {
    global.WIKI_STORES = {
      site: useSiteStore(),
      user: useUserStore()
    }
  } else {
    window.WIKI_STORES = {
      site: useSiteStore(),
      user: useUserStore()
    }
  }
})
