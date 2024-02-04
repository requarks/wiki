import { boot } from 'quasar/wrappers'
import { createI18n } from 'vue-i18n'

import { useCommonStore } from 'src/stores/common'

export default boot(({ app, store }) => {
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
})
