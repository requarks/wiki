<template lang="pug">
router-view
</template>

<script setup>
import { nextTick, onMounted, reactive, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useFlagsStore } from 'src/stores/flags'
import { useSiteStore } from 'src/stores/site'
import { useUserStore } from 'src/stores/user'
import { setCssVar, useQuasar } from 'quasar'

import '@mdi/font/css/materialdesignicons.css'

/* global siteConfig */

// QUASAR

const $q = useQuasar()

// STORES

const flagsStore = useFlagsStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

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

// THEME

function applyTheme () {
  if (userStore.appearance === 'site') {
    $q.dark.set(siteStore.theme.dark)
  } else {
    $q.dark.set(userStore.appearance === 'dark')
  }
  setCssVar('primary', userStore.getAccessibleColor('primary', siteStore.theme.colorPrimary))
  setCssVar('secondary', userStore.getAccessibleColor('secondary', siteStore.theme.colorSecondary))
  setCssVar('accent', userStore.getAccessibleColor('accent', siteStore.theme.colorAccent))
  setCssVar('header', userStore.getAccessibleColor('header', siteStore.theme.colorHeader))
  setCssVar('sidebar', userStore.getAccessibleColor('sidebar', siteStore.theme.colorSidebar))
  setCssVar('positive', userStore.getAccessibleColor('positive', '#02C39A'))
  setCssVar('negative', userStore.getAccessibleColor('negative', '#f03a47'))
}

// INIT SITE STORE

if (typeof siteConfig !== 'undefined') {
  siteStore.$patch({
    id: siteConfig.id,
    title: siteConfig.title
  })
  applyTheme()
}

router.beforeEach(async (to, from) => {
  siteStore.routerLoading = true
  // System Flags
  if (!flagsStore.loaded) {
    flagsStore.load()
  }
  // Site Info
  if (!siteStore.id) {
    console.info('No pre-cached site config. Loading site info...')
    await siteStore.loadSite(window.location.hostname)
    console.info(`Using Site ID ${siteStore.id}`)
  }
  // User Auth
  await userStore.refreshAuth()
  // User Profile
  if (userStore.authenticated && !userStore.profileLoaded) {
    console.info(`Refreshing user ${userStore.id} profile...`)
    await userStore.refreshProfile()
  }
  // Apply Theme
  applyTheme()
})
router.afterEach(() => {
  if (!state.isInitialized) {
    state.isInitialized = true
    document.querySelector('.init-loading').remove()
  }
  siteStore.routerLoading = false
})
</script>
