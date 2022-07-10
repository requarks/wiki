<template lang="pug">
router-view
</template>

<script setup>
import { nextTick, onMounted, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useSiteStore } from 'src/stores/site'
import { setCssVar, useQuasar } from 'quasar'

/* global siteConfig */

// QUASAR

const $q = useQuasar()

// STORES

const siteStore = useSiteStore()

// ROUTER

const router = useRouter()

// STATE

const state = reactive({
  isInitialized: false
})

// THEME

function applyTheme () {
  $q.dark.set(siteStore.theme.dark)
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
  if (!siteStore.id) {
    console.info('No pre-cached site config. Loading site info...')
    await siteStore.loadSite(window.location.hostname)
    console.info(`Using Site ID ${siteStore.id}`)
    applyTheme()
  }
})
router.afterEach(() => {
  if (!state.isInitialized) {
    state.isInitialized = true
    document.querySelector('.init-loading').remove()
  }
  siteStore.routerLoading = false
})
</script>
