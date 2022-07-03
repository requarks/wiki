<template lang="pug">
router-view
</template>

<script setup>
import { nextTick, onMounted } from 'vue'
import { useSiteStore } from 'src/stores/site'

/* global siteConfig */

// STORES

const siteStore = useSiteStore()

// INIT SITE STORE

if (typeof siteConfig !== 'undefined') {
  siteStore.$patch({
    id: siteConfig.id,
    title: siteConfig.title
  })
} else {
  siteStore.loadSite(window.location.hostname)
}

// MOUNTED

onMounted(async () => {
  nextTick(() => {
    document.querySelector('.init-loading').remove()
  })
})
</script>
