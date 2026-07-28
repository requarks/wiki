<template>
  <w-dialog
    v-model="siteStore.overlayIsShown"
    class="main-overlay"
    persistent
    full-width
    full-height>
    <component :is="overlays[siteStore.overlay]" />
  </w-dialog>
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
  NavEdit: defineAsyncComponent({
    loader: () => import('./NavEditOverlay.vue'),
    loadingComponent: LoadingGeneric
  }),
  PageSource: defineAsyncComponent({
    loader: () => import('./PageSourceOverlay.vue'),
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
