<template lang='pug'>
router-view
</template>

<script setup>
import { reactive, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { setCssVar, useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'

import { useCommonStore } from './stores/common'
import { useFlagsStore } from '@/stores/flags'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

/* global siteConfig */

// QUASAR

const $q = useQuasar()

// STORES

const commonStore = useCommonStore()
const flagsStore = useFlagsStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// I18N

const i18n = useI18n({ useScope: 'global' })

// ROUTER

const router = useRouter()

// STATE

const state = reactive({
  isInitialized: false
})

// WATCHERS

watch(() => userStore.appearance, (newValue) => {
  if (newValue === 'site') {
    $q.dark.set(siteStore.theme.dark)
  } else {
    $q.dark.set(newValue === 'dark')
  }
})

watch(() => userStore.cvd, () => {
  applyTheme()
})

watch(() => commonStore.locale, applyLocale)

// LOCALE

async function applyLocale (locale) {
  if (!i18n.availableLocales.includes(locale)) {
    try {
      i18n.setLocaleMessage(locale, await commonStore.fetchLocaleStrings(locale))
    } catch (err) {
      $q.notify({
        type: 'negative',
        message: `Failed to load ${locale} locale strings.`,
        caption: err.message
      })
    }
  }
  i18n.locale.value = locale
}

// THEME

async function applyTheme () {
  // -> Dark Mode
  if (userStore.appearance === 'site') {
    $q.dark.set(siteStore.theme.dark)
  } else {
    $q.dark.set(userStore.appearance === 'dark')
  }

  // -> CSS Vars
  setCssVar('primary', userStore.getAccessibleColor('primary', siteStore.theme.colorPrimary))
  setCssVar('secondary', userStore.getAccessibleColor('secondary', siteStore.theme.colorSecondary))
  setCssVar('accent', userStore.getAccessibleColor('accent', siteStore.theme.colorAccent))
  setCssVar('header', userStore.getAccessibleColor('header', siteStore.theme.colorHeader))
  setCssVar('sidebar', userStore.getAccessibleColor('sidebar', siteStore.theme.colorSidebar))
  setCssVar('positive', userStore.getAccessibleColor('positive', '#02C39A'))
  setCssVar('negative', userStore.getAccessibleColor('negative', '#f03a47'))

  // -> Highlight.js Theme
  if (siteStore.theme.codeBlocksTheme) {
    const desiredHljsTheme = userStore.cvd !== 'none' ? 'github' : siteStore.theme.codeBlocksTheme

    const hljsStyleEl = document.querySelector('#hljs-theme')
    if (hljsStyleEl) {
      hljsStyleEl.remove()
    }

    const newHljsStyleEl = document.createElement('style')
    newHljsStyleEl.id = 'hljs-theme'
    // newHljsStyleEl.innerHTML = (await import(`../node_modules/highlight.js/styles/${desiredHljsTheme}.css`)).default
    document.head.appendChild(newHljsStyleEl)
  }
}

// INIT SITE STORE

if (typeof siteConfig !== 'undefined') {
  siteStore.$patch({
    id: siteConfig.id,
    title: siteConfig.title
  })
  applyTheme()
}

// ROUTE GUARDS

router.beforeEach(async (to, from) => {
  commonStore.routerLoading = true

  // -> Init Auth Token
  if (userStore.token && !userStore.authenticated) {
    userStore.loadToken()
  }

  // -> System Flags
  if (!flagsStore.loaded) {
    flagsStore.load()
  }

  // -> Site Info
  if (!siteStore.id) {
    console.info('No pre-cached site config. Loading site info...')
    await siteStore.loadSite(window.location.hostname)
    console.info(`Using Site ID ${siteStore.id}`)
  }

  // -> Locale
  if (!commonStore.desiredLocale || !siteStore.locales.active.some(l => l.code === commonStore.desiredLocale)) {
    commonStore.setLocale(siteStore.locales.primary)
  } else {
    applyLocale(commonStore.desiredLocale)
  }

  // -> User Profile
  if (userStore.authenticated && !userStore.profileLoaded) {
    console.info(`Refreshing user ${userStore.id} profile...`)
    await userStore.refreshProfile()
  }

  // -> Page Permissions
  await userStore.fetchPagePermissions(to.path)
})

// GLOBAL EVENTS HANDLERS

EVENT_BUS.on('logout', () => {
  router.push('/')
  $q.notify({
    type: 'positive',
    icon: 'las la-sign-out-alt',
    message: i18n.t('auth.logoutSuccess')
  })
})
EVENT_BUS.on('applyTheme', () => {
  applyTheme()
})

// LOADER

router.afterEach(() => {
  if (!state.isInitialized) {
    state.isInitialized = true
    applyTheme()
    document.querySelector('.init-loading').remove()
  }
  commonStore.routerLoading = false
})

</script>
