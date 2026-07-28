import { createApp } from 'vue'
import { initializeRouter } from './router'
import { initializeStore } from './stores'
import { initializeApi } from './boot/api'
import { initializeComponents } from './boot/components'
import { initializeEventBus } from './boot/eventbus'
import { initializeExternals } from './boot/externals'
import { initializeI18n } from './boot/i18n'
import { initializeIconify } from './boot/iconify'
import { initializeTemporal } from './boot/temporal'
import { initializeHairlines } from './helpers/hairline'

// Roboto only: icon data is inlined at build time by scripts/generate-icons.mjs,
// so no icon webfont is loaded.
import '@quasar/extras/roboto-font/roboto-font.css'

import './css/tailwind.css'
import './css/app.scss'

import RootApp from './App.vue'

// Must come first: everything below may use Temporal, directly or indirectly.
await initializeTemporal()

const router = initializeRouter()
const store = initializeStore(router)

const app = createApp(RootApp)
app.use(store)
app.use(router)

initializeHairlines()
initializeApi(store)
initializeComponents(app)
initializeEventBus()
initializeIconify()
initializeExternals(router, store)
initializeI18n(app, store)
app.mount('#app')
