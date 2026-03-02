import { createRouter, createMemoryHistory, createWebHistory } from 'vue-router'
import routes from './routes'

export function initializeRouter () {
  const createHistory = import.meta.env.SSR
    ? createMemoryHistory
    : createWebHistory

  const router = createRouter({
    scrollBehavior: () => ({ left: 0, top: 0 }),
    routes,
    history: createHistory(import.meta.env.BASE_URL)
  })

  return router
}
