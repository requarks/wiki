<template>
  <w-layout>
    <w-header class="site-header-wrap">
      <header-nav />
    </w-header>
    <!--
      No `<w-drawer>`, for the reason `VersionLayout` has none: a live note is reached from a link
      rather than browsed to, and is no place in the tree the navigation sidebar describes. It is the
      editor and nothing else, so neither is there scroll-to-top -- the editor's two panes scroll on
      their own.
    -->
    <w-page-container>
      <router-view />
    </w-page-container>
    <!--
      The overlays the Markdown editor opens -- the block picker, the table editor, a block's content
      editor -- and the note's revisions. All of them go through `siteStore.overlay`, which this is what
      draws.
    -->
    <main-overlay-dialog />
  </w-layout>
</template>

<script setup>
import { useMeta } from '@/composables/meta'

import { useSiteStore } from '@/stores/site'

// COMPONENTS

import HeaderNav from '@/components/HeaderNav.vue'
import MainOverlayDialog from '@/components/MainOverlayDialog.vue'

// STORES

const siteStore = useSiteStore()

// META

// -> The same title template as `MainLayout`; the note supplies the title half
useMeta(() => {
  const siteTitle = siteStore.title
  return {
    titleTemplate: (title) => (title ? `${title} - ${siteTitle}` : siteTitle)
  }
})
</script>

<style lang="scss">
/* -> The window behind the shell in the dark theme, which every page-shaped layout declares for itself;
      see `VersionLayout.vue` */
body.body--dark {
  background-color: $dark-6;
}
</style>
