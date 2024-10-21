<template lang="pug">
q-dialog(
  v-model='siteStore.sideDialogShown'
  position='right'
  full-height
  transition-show='jump-left'
  transition-hide='jump-right'
  class='floating-sidepanel'
  no-shake
  )
  component(:is='sideDialogs[siteStore.sideDialogComponent]')
</template>

<script setup>
import { useQuasar } from 'quasar'
import { computed, defineAsyncComponent, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { useEditorStore } from '@/stores/editor'
import { useFlagsStore } from '@/stores/flags'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

// COMPONENTS

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

// QUASAR

const $q = useQuasar()

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

.floating-sidepanel {
  .q-dialog__inner {
    right: 24px;

    .q-card {
      border-radius: 4px !important;
      min-width: 450px;

      .q-card__section {
        border-radius: 0;
      }
    }
  }

  .alt-card {
    @at-root .body--light & {
      background-color: $grey-2;
      border-top: 1px solid $grey-4;
      box-shadow: inset 0 1px 0 0 #FFF, inset 0 -1px 0 0 #FFF;
      border-bottom: 1px solid $grey-4;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
      border-top: 1px solid color.adjust($dark-3, $lightness: 8%);
      box-shadow: inset 0 1px 0 0 $dark-6, inset 0 -1px 0 0 $dark-6;
      border-bottom: 1px solid color.adjust($dark-3, $lightness: 8%);
    }
  }

  &-quickaccess {
    width: 40px;
    border-radius: 4px !important;
    background-color: rgba(0,0,0,.75);
    backdrop-filter: blur(5px);
    color: #FFF;
    position: fixed;
    right: 486px;
    top: 74px;
    z-index: -1;
    display: flex;
    flex-direction: column;
    box-shadow: 0 0 5px 0 rgba(0,0,0,.5) !important;

    @at-root .q-transition--jump-left-enter-active & {
      display: none !important;
    }

    @at-root .q-transition--jump-right-leave-active & {
      display: none !important;
    }
  }
}
</style>
