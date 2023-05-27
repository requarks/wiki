<template lang="pug">
q-dialog.main-overlay(
  v-model='siteStore.overlayIsShown'
  persistent
  full-width
  full-height
  no-shake
  transition-show='jump-up'
  transition-hide='jump-down'
  )
  component(:is='overlays[siteStore.overlay]')
</template>

<script setup>
import { defineAsyncComponent } from 'vue'

import { useSiteStore } from '../stores/site'

import LoadingGeneric from './LoadingGeneric.vue'

const overlays = {
  EditorMarkdownConfig: defineAsyncComponent({
    loader: () => import('./EditorMarkdownUserSettingsOverlay.vue'),
    loadingComponent: LoadingGeneric
  }),
  FileManager: defineAsyncComponent({
    loader: () => import('./FileManager.vue'),
    loadingComponent: LoadingGeneric
  }),
  TableEditor: defineAsyncComponent({
    loader: () => import('./TableEditorOverlay.vue'),
    loadingComponent: LoadingGeneric
  }),
  Welcome: defineAsyncComponent({
    loader: () => import('./WelcomeOverlay.vue'),
    loadingComponent: LoadingGeneric
  })
}

// STORES

const siteStore = useSiteStore()
</script>
