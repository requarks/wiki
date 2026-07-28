<template>
  <w-layout>
    <w-header class="site-header-wrap">
      <header-nav />
    </w-header>
    <w-drawer
      class="bg-sidebar"
      :model-value="isSidebarShown"
      :show-if-above="siteStore.theme.sidebarPosition !== `off`"
      :width="isSidebarMini ? 56 : 255"
      :side="siteStore.theme.sidebarPosition === `right` ? `right` : `left`">
      <div v-if="isSidebarMini" class="sidebar-mini flex flex-col items-stretch">
        <w-btn class="py-4" flat icon="la:globe" color="white" aria-label="Switch Locale">
          <locale-selector-menu anchor="top right" self="top left" />
          <w-tooltip anchor="center right" self="center left">Switch Locale</w-tooltip>
        </w-btn>
        <w-btn
          class="py-4"
          flat
          icon="la:sitemap"
          color="white"
          aria-label="Browse"
          @click="notImplemented">
          <w-tooltip anchor="center right" self="center left">Browse</w-tooltip>
        </w-btn>
        <w-separator class="my-2" inset dark />
        <w-btn
          class="py-4"
          flat
          icon="la:bookmark"
          color="white"
          aria-label="Bookmarks"
          @click="notImplemented">
          <w-tooltip anchor="center right" self="center left">Bookmarks</w-tooltip>
        </w-btn>
        <w-space />
        <w-btn
          v-if="canEditNav"
          class="py-1"
          flat
          icon="la:dharmachakra"
          color="white"
          aria-label="Edit Nav"
          size="sm">
          <w-menu ref="navEditMenuMini" anchor="top right" self="bottom left">
            <nav-edit-menu
              :menu-hide-handler="navEditMenuMini.hide"
              :update-position-handler="navEditMenuMini.updatePosition" />
          </w-menu>
          <w-tooltip anchor="center right" self="center left">Edit Nav</w-tooltip>
        </w-btn>
      </div>
      <template v-else>
        <div class="sidebar-actions flex flex-nowrap items-stretch">
          <w-btn
            class="flex-1 px-2"
            flat
            dense
            icon="la:globe"
            color="blue-7"
            text-color="custom-color"
            :label="commonStore.locale"
            :aria-label="commonStore.locale"
            size="sm">
            <locale-selector-menu :offset="[-5, 5]" />
          </w-btn>
          <w-separator vertical />
          <w-btn
            class="flex-1 px-2"
            flat
            dense
            icon="la:sitemap"
            color="blue-7"
            text-color="custom-color"
            label="Browse"
            aria-label="Browse"
            size="sm"
            @click="notImplemented" />
        </div>
        <nav-sidebar />
        <w-bar v-if="userStore.authenticated" class="sidebar-footerbtns text-white" dense>
          <template v-if="canEditNav">
            <w-btn class="flex-1" icon="la:dharmachakra" label="Edit Nav" flat>
              <w-menu ref="navEditMenu" anchor="top left" self="bottom left" :offset="[0, 10]">
                <nav-edit-menu
                  :menu-hide-handler="navEditMenu.hide"
                  :update-position-handler="navEditMenu.updatePosition" />
              </w-menu>
            </w-btn>
            <w-separator vertical />
          </template>
          <w-btn
            class="flex-1"
            icon="la:bookmark"
            label="Bookmarks"
            flat
            @click="notImplemented" />
        </w-bar>
      </template>
    </w-drawer>
    <w-page-container>
      <router-view />
      <w-page-scroller :scroll-offset="150" :offset="[15, 15]">
        <w-btn icon="la:arrow-up" color="primary" round size="md" />
      </w-page-scroller>
    </w-page-container>
    <main-overlay-dialog />
    <w-footer v-if="!editorStore.isActive">
      <footer-nav />
    </w-footer>
  </w-layout>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { useI18n } from 'vue-i18n'

import { useCommonStore } from '@/stores/common'
import { useEditorStore } from '@/stores/editor'
import { useFlagsStore } from '@/stores/flags'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

// COMPONENTS

import FooterNav from '@/components/FooterNav.vue'
import HeaderNav from '@/components/HeaderNav.vue'
import LocaleSelectorMenu from '@/components/LocaleSelectorMenu.vue'
import NavSidebar from '@/components/NavSidebar.vue'
import NavEditMenu from '@/components/NavEditMenu.vue'
import MainOverlayDialog from '@/components/MainOverlayDialog.vue'

// STORES

const commonStore = useCommonStore()
const editorStore = useEditorStore()
const flagsStore = useFlagsStore()
const pageStore = usePageStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// META

useMeta({
  titleTemplate: (title) => `${title} - ${siteStore.title}`
})

// REFS

const navEditMenu = ref(null)
const navEditMenuMini = ref(null)

// COMPUTED

const isSidebarShown = computed(() => {
  return (
    siteStore.showSideNav &&
    !siteStore.sideNavIsDisabled &&
    !(editorStore.isActive && editorStore.hideSideNav)
  )
})

const isSidebarMini = computed(() => {
  return ['hide', 'hideExact'].includes(pageStore.navigationMode) || !pageStore.navigationId
})

// -> Saving from this menu needs manage:navigation, so offering it to anyone else only produces a
//    permission error once they press Save
const canEditNav = computed(() => {
  return userStore.authenticated && userStore.can('manage:navigation')
})

// METHODS

function notImplemented() {
  notify({
    type: 'negative',
    message: 'Not implemented'
  })
}
</script>

<style lang="scss">
.sidebar-actions {
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 0%, rgba(0, 0, 0, 0.05) 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.2);
  height: 38px;

  .w-btn {
    color: rgba(255, 255, 255, 0.8);
  }
}

.sidebar-mini {
  height: 100%;
}

.sidebar-footerbtns {
  background-color: rgba(255, 255, 255, 0.1);
}

body.body--dark {
  background-color: $dark-6;
}

// -> Ported from the Quasar dialog internals onto WDialog's own structure:
//    .q-dialog__backdrop -> .w-dialog-backdrop, .q-dialog__inner -> .w-dialog-viewport,
//    .q-layout-container -> .w-dialog-panel
.main-overlay {
  > .w-dialog-backdrop {
    background-color: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(5px) saturate(180%);
  }
  > .w-dialog-viewport {
    padding: 24px 64px;

    @media (max-width: $breakpoint-sm-max) {
      padding: 0;
    }

    > .w-dialog-panel {
      border-radius: 6px;
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

// -> The `.q-footer .q-bar` rule that used to sit here never matched: FooterNav renders
//    `.site-footer`, never a q-bar. Its colours live in FooterNav's own scoped style.

.syncing-enter-active {
  animation: syncing-anim 0.1s;
}
.syncing-leave-active {
  animation: syncing-anim 1s reverse;
}
@keyframes syncing-anim {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}
</style>
