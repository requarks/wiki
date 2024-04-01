import { createApp } from 'vue'
import { Quasar, Dialog, Loading, LoadingBar, Meta, Notify } from 'quasar'
import { initializeRouter } from './router'
import { initializeStore } from './stores'
import { initializeApollo } from './boot/apollo'
import { initializeComponents } from './boot/components'
import { initializeEventBus } from './boot/eventbus'
import { initializeExternals } from './boot/externals'
import { initializeI18n } from './boot/i18n'
import quasarIconSet from 'quasar/icon-set/mdi-v7'

// Import icon libraries
import '@quasar/extras/roboto-font/roboto-font.css'
import '@mdi/font/css/materialdesignicons.css'
import '@quasar/extras/line-awesome/line-awesome.css'

// Import Quasar css
import 'quasar/src/css/index.sass'
import './css/app.scss'

import RootApp from './App.vue'

const router = initializeRouter()
const store = initializeStore(router)

const app = createApp(RootApp)
app.use(store)
app.use(router)

initializeApollo(store)
initializeComponents(app)
initializeEventBus()
initializeExternals(router, store)
initializeI18n(app, store)

app.use(Quasar, {
  plugins: {
    Dialog,
    Loading,
    LoadingBar,
    Meta,
    Notify
  },
  iconSet: quasarIconSet,
  config: {
    brand: {
      header: '#000',
      sidebar: '#1976D2'
    },
    loading: {
      delay: 500,
      spinner: 'QSpinnerGrid',
      spinnerSize: 32,
      spinnerColor: 'white',
      customClass: 'loading-darker'
    },
    loadingBar: {
      color: 'primary',
      size: '1px',
      position: 'top'
    },
    notify: {
      position: 'top',
      progress: true,
      color: 'green',
      icon: 'las la-check',
      actions: [
        {
          icon: 'las la-times',
          color: 'white',
          size: 'sm',
          round: true,
          handler: () => {}
        }
      ]
    }
  }
})

app.mount('#app')
