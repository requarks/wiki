<template lang='pug'>
q-layout(view='hHh Lpr lff')
  header-nav(@toggle-sidebar='sidebarOpen = !sidebarOpen')
  q-drawer.docs-sidebar(
    v-model='sidebarOpen'
    :show-if-above='siteStore.theme.sidebarPosition !== `off`'
    :width='260'
    :side='siteStore.theme.sidebarPosition === `right` ? `right` : `left`'
    bordered
    :breakpoint='1024'
    )
    .docs-sidebar-content
      nav-sidebar
  q-page-container
    router-view
    q-page-scroller(
      position='bottom-right'
      :scroll-offset='150'
      :offset='[15, 15]'
      )
      q-btn(
        icon='las la-arrow-up'
        color='primary'
        round
        size='sm'
      )
  main-overlay-dialog
</template>

<script setup>
import { useMeta, useQuasar } from 'quasar'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { useCommonStore } from '@/stores/common'
import { useEditorStore } from '@/stores/editor'
import { useFlagsStore } from '@/stores/flags'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import HeaderNav from '@/components/HeaderNav.vue'
import NavSidebar from '@/components/NavSidebar.vue'
import MainOverlayDialog from '@/components/MainOverlayDialog.vue'

const $q = useQuasar()
const commonStore = useCommonStore()
const editorStore = useEditorStore()
const flagsStore = useFlagsStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

useMeta({
  titleTemplate: title => `${title} - ${siteStore.title}`
})

const sidebarOpen = ref(true)

function notImplemented () {
  $q.notify({ type: 'negative', message: 'Not implemented' })
}
</script>

<style lang="scss">
.docs-sidebar {
  background: white !important;
  border-right: 1px solid #E2E8F0 !important;

  @at-root .body--dark & {
    background: $dark-5 !important;
    border-right-color: $dark-3 !important;
  }

  &-content {
    height: 100%;
    overflow-y: auto;
    padding: 12px 0;
  }

  .q-item {
    border-radius: 6px;
    margin: 1px 8px;
    padding: 6px 12px;
    min-height: 34px;
    font-size: 0.875rem;
    color: #4B4B53;
    transition: all 0.15s;

    &:hover {
      background: #F4F7FA;
      color: #19191C;
    }

    &--active, &.router-link-active {
      background: #E6F1FE !important;
      color: #006FEE !important;
      font-weight: 600;
    }

    .q-item__label {
      font-size: 0.875rem;
      line-height: 1.3;
    }

    @at-root .body--dark & {
      color: #9CA3AF;
      &:hover { background: $dark-4; color: #E2E8F0; }
      &--active, &.router-link-active {
        background: rgba(0,111,238,0.15) !important;
        color: #5BA7FF !important;
      }
    }
  }

  .q-expansion-item {
    .q-item {
      font-weight: 500;
    }
  }
}

// Remove footer
.q-footer { display: none !important; }

// Clean page container
.q-page-container {
  background: #FAFBFC;

  @at-root .body--dark & {
    background: $dark-6;
  }
}

// Content styling
.page-contents, .contents {
  max-width: 860px;
  margin: 0 auto;
  padding: 32px 24px;
}

body.body--dark {
  background-color: $dark-6;
}

.main-overlay {
  > .q-dialog__backdrop {
    background-color: rgba(0,0,0,.6);
    backdrop-filter: blur(5px) saturate(180%);
  }
  > .q-dialog__inner {
    padding: 24px 64px;
    @media (max-width: $breakpoint-sm-max) { padding: 0; }
    > .q-layout-container {
      border-radius: 6px;
      box-shadow: 0 0 30px 0 rgba(0,0,0,.3);
      @at-root .body--light & {
        background-image: linear-gradient(to bottom, $dark-5 10px, $grey-3 11px, $grey-4);
      }
      @at-root .body--dark & {
        background-image: linear-gradient(to bottom, $dark-4 10px, $dark-4 11px, $dark-3);
      }
    }
  }
}

.syncing-enter-active { animation: syncing-anim .1s; }
.syncing-leave-active { animation: syncing-anim 1s reverse; }
@keyframes syncing-anim {
  0% { opacity: 0; }
  100% { opacity: 1; }
}
</style>
