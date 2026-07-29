<template>
  <w-dialog
    class="floating-sidepanel"
    v-model="siteStore.sideDialogShown"
    position="right"
    full-height
    transition-show="jump-left"
    transition-hide="jump-right"
    no-shake>
    <component :is="sideDialogs[siteStore.sideDialogComponent]" />
  </w-dialog>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { useEditorStore } from '@/stores/editor'
import { useFlagsStore } from '@/stores/flags'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

import LoadingGeneric from '@/components/LoadingGeneric.vue'

const sideDialogs = {
  PageDataDialog: defineAsyncComponent({
    loader: () => import('@/components/PageDataDialog.vue'),
    loadingComponent: LoadingGeneric
  }),
  PagePropertiesDialog: defineAsyncComponent({
    loader: () => import('@/components/PagePropertiesDialog.vue'),
    loadingComponent: LoadingGeneric
  })
}

// STORES

const editorStore = useEditorStore()
const flagsStore = useFlagsStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  showSideDialog: false,
  sideDialogComponent: null,
  showGlobalDialog: false,
  globalDialogComponent: null,
  showTagsEditBtn: false,
  tagEditMode: false,
  tocExpanded: ['h1-0', 'h1-1'],
  tocSelected: [],
  currentRating: 3
})
</script>

<style lang="scss">
@use 'sass:color';

/*
  The rules that used to sit here hung off `.q-dialog__inner` and `.w-card__section`, neither of which
  this app renders any more -- so the inset, the radius and the panel's minimum width had all silently
  stopped applying. The inset and radius now come from WDialog's own `right` variant, where they
  belong; only the panel's floor width is a side-panel concern, and it is stated on the panel itself.
*/
.floating-sidepanel {
  /*
    A definite width, not the `min-width: 450px` this replaces. The panel's content arrives
    asynchronously behind a loading placeholder, and while the width was content-driven it changed
    when the real dialog swapped in -- which, on a right-justified panel, jumped the left edge 112px
    mid-transition and made a 32px slide look like a lurch. 560px is the width the content settles at
    anyway; measured, nothing inside asks for more, date picker included.
  */
  .w-dialog-panel {
    width: 560px;
  }

  .alt-card {
    @at-root .body--light & {
      background-color: $grey-2;
      border-top: 1px solid $grey-4;
      box-shadow:
        inset 0 1px 0 0 #fff,
        inset 0 -1px 0 0 #fff;
      border-bottom: 1px solid $grey-4;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
      border-top: 1px solid color.adjust($dark-3, $lightness: 8%);
      box-shadow:
        inset 0 1px 0 0 $dark-6,
        inset 0 -1px 0 0 $dark-6;
      border-bottom: 1px solid color.adjust($dark-3, $lightness: 8%);
    }
  }

  /*
    The quick-jump rail, which sits outside the panel's left edge.

    Two things kept it off screen. It was `position: fixed` at a hard-coded `right: 486px`, a number
    derived from a panel 450px wide with a 24px margin -- once the panel sized itself to its content
    (562px) that offset landed the rail INSIDE the panel. And `z-index: -1` then painted it behind the
    card's own background, so even overlapping it was invisible.

    Anchored to the card instead (`WCard` is a positioned element), so it tracks whatever width the
    panel ends up with. The two `.q-transition--jump-*` rules that hid it mid-animation are gone with
    the Quasar transitions they named; the 300ms timer in the dialog already keeps it out of the slide.
  */
  &-quickaccess {
    position: absolute;
    right: calc(100% + 12px);
    top: 24px;
    width: 40px;
    display: flex;
    flex-direction: column;
    border-radius: 4px;
    background-color: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(5px);
    color: #fff;
    box-shadow: 0 0 5px 0 rgba(0, 0, 0, 0.5);
  }
}
</style>
