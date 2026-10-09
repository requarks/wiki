import { createRouter, createMemoryHistory, createWebHistory } from 'vue-router'
import routes from './routes'
import { isGlossaryOnlyChange } from '@/helpers/glossaryUrl'

export function initializeRouter() {
  const createHistory = import.meta.env.SSR ? createMemoryHistory : createWebHistory

  const router = createRouter({
    // -> Browsing the glossary rewrites the query of the page behind it, which must stay where it is
    scrollBehavior: (to, from) => (isGlossaryOnlyChange(to, from) ? false : { left: 0, top: 0 }),
    routes,
    history: createHistory(import.meta.env.BASE_URL)
  })

  return router
}
