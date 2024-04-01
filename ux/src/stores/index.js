import { createPinia } from 'pinia'
import { markRaw } from 'vue'

export function initializeStore (router) {
  const pinia = createPinia()

  // You can add Pinia plugins here
  // pinia.use(SomePiniaPlugin)

  pinia.use(({ store }) => {
    store.router = markRaw(router)
  })

  return pinia
}
