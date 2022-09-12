<template lang="pug">
router-view
</template>

<script setup>
import { nextTick, onMounted, reactive, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSiteStore } from 'src/stores/site'
import { useUserStore } from 'src/stores/user'
import { setCssVar, useQuasar } from 'quasar'

/* global siteConfig */

// QUASAR

const $q = useQuasar()

// STORES

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

// THEME

function applyTheme () {
  if (userStore.appearance === 'site') {
    $q.dark.set(siteStore.theme.dark)
  } else {
    $q.dark.set(userStore.appearance === 'dark')
  }
  setCssVar('primary', siteStore.theme.colorPrimary)
  setCssVar('secondary', siteStore.theme.colorSecondary)
  setCssVar('accent', siteStore.theme.colorAccent)
  setCssVar('header', siteStore.theme.colorHeader)
  setCssVar('sidebar', siteStore.theme.colorSidebar)
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
