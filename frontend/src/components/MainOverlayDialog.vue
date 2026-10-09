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
import { defineAsyncComponent, watch } from 'vue'
import { useRoute } from 'vue-router'

import { glossaryFromRoute } from '../helpers/glossaryUrl'
import { useSiteStore } from '../stores/site'

import LoadingGeneric from './LoadingGeneric.vue'

const overlays = {
  BlockContentEditor: defineAsyncComponent({
    loader: () => import('./BlockContentEditorOverlay.vue'),
    loadingComponent: LoadingGeneric
  }),
  BlockPicker: defineAsyncComponent({
    loader: () => import('./BlockPickerOverlay.vue'),
    loadingComponent: LoadingGeneric
  }),
  EditorMarkdownConfig: defineAsyncComponent({
    loader: () => import('./EditorMarkdownUserSettingsOverlay.vue'),
    loadingComponent: LoadingGeneric
  }),
  FileManager: defineAsyncComponent({
    loader: () => import('./FileManager.vue'),
    loadingComponent: LoadingGeneric
  }),
  Glossary: defineAsyncComponent({
    loader: () => import('./GlossaryOverlay.vue'),
    loadingComponent: LoadingGeneric
  }),
  NavEdit: defineAsyncComponent({
    loader: () => import('./NavEditOverlay.vue'),
    loadingComponent: LoadingGeneric
  }),
  PageHistory: defineAsyncComponent({
    loader: () => import('./PageHistoryOverlay.vue'),
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

const route = useRoute()

/*
  `?glossary=<name>` opens the glossary over whatever this is mounted under (spec §7). Here because
  this is what every screen able to show the overlay mounts, and it is the one thing still standing
  when the overlay is not. Once open, the overlay keeps the URL in step itself -- and follows it, for a
  name that changes while it is open.

  The parameter going away with the overlay still up is the reader stepping back past where it was
  opened, and the overlay goes with it.
*/
watch(
  () => glossaryFromRoute(route),
  (wanted) => {
    if (!wanted) {
      if (siteStore.overlay === 'Glossary') {
        siteStore.$patch({ overlay: '' })
      }
      return
    }
    if (siteStore.overlay !== 'Glossary') {
      siteStore.openGlossary({ name: wanted.name || null, locale: wanted.locale })
    }
  },
  { immediate: true }
)
</script>
