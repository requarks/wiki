import { createI18n } from 'vue-i18n'
import { useCommonStore } from '@/stores/common'

export function initializeI18n (app, store) {
  const commonStore = useCommonStore(store)

  const i18n = createI18n({
    legacy: false,
    locale: commonStore.locale || 'en',
    fallbackLocale: 'en',
    fallbackWarn: false,
    messages: {}
  })

  // Set i18n instance on app
  app.use(i18n)
}
