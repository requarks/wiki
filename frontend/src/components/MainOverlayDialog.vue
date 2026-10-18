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
  LiveNoteRevisions: defineAsyncComponent({
    loader: () => import('./LiveNoteRevisionsOverlay.vue'),
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

<style lang="scss">
/*
  The overlay's backdrop and panel. Here, with the component that draws them, rather than in
  `MainLayout` where they used to be: an unscoped rule in a layout only exists once that layout's chunk
  has loaded, and `LiveNoteLayout` mounts this overlay too -- a note opened straight from its link drew
  every overlay with no backdrop and no panel behind it.
*/
// -> Ported from the Quasar dialog internals onto WDialog's own structure:
//    .q-dialog__backdrop -> .w-dialog-backdrop, .q-dialog__inner -> .w-dialog-viewport,
//    .q-layout-container -> .w-dialog-panel
.main-overlay {
  > .w-dialog-backdrop {
    background-color: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(5px) saturate(180%);
  }
  > .w-dialog-viewport {
    /*
      Equal margins all round, until there is width to spare for more.

      64px down each side is pitched for a wide desktop; on a 1280 or 1440 window it is an eighth of
      the screen taken off a panel that is a file listing or a table, and the overlay ends up narrower
      than the page it was opened from. Below 1600 the sides come in to match the 24px above and below,
      which is the clearance that says "over the page" -- more than that is decoration.

      1600 is this rule's own number, not one of the app's `--breakpoint-*`: it is where an overlay is
      wide enough that 128px of it can go to margins without the content noticing.
    */
    padding: 24px;

    @media (min-width: 1600px) {
      padding: 24px 64px;
    }

    // -> Last of the three, so it still wins on a phone: all three have the same specificity
    @media (max-width: $breakpoint-sm-max) {
      padding: 0;
    }

    // -> The radius is WDialog's, and the panel clips to it there; this only adds the depth and the
    //    title-bar strip an overlay wants on top of it
    > .w-dialog-panel {
      box-shadow: 0 0 30px 0 rgba(0, 0, 0, 0.3);

      @at-root .body--light & {
        background-image: linear-gradient(to bottom, $dark-5 10px, $grey-3 11px, $grey-4);
      }
      @at-root .body--dark & {
        background-image: linear-gradient(to bottom, $dark-4 10px, $dark-4 11px, $dark-3);
      }
    }
  }
}
</style>
