<template>
  <w-layout>
    <w-header class="site-header-wrap">
      <header-nav />
    </w-header>
    <w-drawer
      class="bg-sidebar"
      :model-value="isSidebarShown"
      :show-if-above="siteStore.theme.sidebarPosition !== `off`"
      :width="sidebarWidth"
      :side="siteStore.theme.sidebarPosition === `right` ? `right` : `left`">
      <div v-if="isSidebarMini" class="sidebar-mini flex flex-col items-stretch">
        <w-btn
          v-if="siteStore.locales.showMenu"
          class="py-4"
          flat
          icon="la:globe"
          color="white"
          aria-label="Switch Locale">
          <locale-selector-menu anchor="top right" self="top left" />
          <w-tooltip anchor="center right" self="center left">Switch Locale</w-tooltip>
        </w-btn>
        <w-btn
          v-if="canBrowse"
          class="py-4"
          flat
          icon="la:sitemap"
          color="white"
          :aria-label="t(`common.sidebar.browse`)">
          <nav-browse-menu anchor="top right" self="top left" />
          <w-tooltip anchor="center right" self="center left">
            {{ t('common.sidebar.browse') }}
          </w-tooltip>
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
        <div v-if="showSidebarActions" class="sidebar-actions flex flex-nowrap items-stretch">
          <!-- -> Either button takes the whole row when the other one is off, and the separator only
               exists to divide the two, so it goes with them -->
          <template v-if="siteStore.locales.showMenu">
            <w-btn
              class="flex-1 px-2"
              flat
              dense
              icon="la:globe"
              :label="commonStore.locale"
              :aria-label="commonStore.locale"
              size="sm">
              <locale-selector-menu :offset="[-5, 5]" />
            </w-btn>
            <w-separator v-if="canBrowse" vertical />
          </template>
          <w-btn
            v-if="canBrowse"
            class="flex-1 px-2"
            flat
            dense
            icon="la:sitemap"
            :label="t(`common.sidebar.browse`)"
            :aria-label="t(`common.sidebar.browse`)"
            size="sm">
            <nav-browse-menu :offset="[-5, 5]" />
          </w-btn>
        </div>
        <nav-sidebar />
        <!-- -> Edit Nav is the whole bar now, so it is also what decides whether there is one -->
        <w-bar v-if="canEditNav" class="sidebar-footerbtns text-white" dense>
          <w-btn class="flex-1" icon="la:dharmachakra" label="Edit Nav" flat>
            <w-menu ref="navEditMenu" anchor="top left" self="bottom left" :offset="[0, 10]">
              <nav-edit-menu
                :menu-hide-handler="navEditMenu.hide"
                :update-position-handler="navEditMenu.updatePosition" />
            </w-menu>
          </w-btn>
        </w-bar>
      </template>
    </w-drawer>
    <!--
      No `<w-footer>` here, unlike every other layout: this one only ever holds the page view, and
      there the article column scrolls inside a shell that holds still, so a footer at this level
      would be pinned to the window no matter which row it took. The page view puts it at the end of
      that scrolling column instead -- see `pages/Index.vue`.
    -->
    <w-page-container>
      <router-view />
      <!-- -> `.page-container-scrl` is the page view's article column, which is what scrolls -->
      <w-page-scroller
        :scroll-offset="150"
        :offset="[15, 15]"
        :anchor-x="scrollerAnchorX"
        target=".page-container-scrl">
        <w-btn icon="la:arrow-up" color="primary" round size="md" />
      </w-page-scroller>
    </w-page-container>
    <main-overlay-dialog />
  </w-layout>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { useMeta } from '@/composables/meta'
import { useMinWidth } from '@/composables/screen'
import { useI18n } from 'vue-i18n'

import { useCommonStore } from '@/stores/common'
import { useEditorStore } from '@/stores/editor'
import { useFlagsStore } from '@/stores/flags'
import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

// COMPONENTS

import HeaderNav from '@/components/HeaderNav.vue'
import LocaleSelectorMenu from '@/components/LocaleSelectorMenu.vue'
import NavBrowseMenu from '@/components/NavBrowseMenu.vue'
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

/*
  A getter that READS the site title, so `watchEffect` has something to track: the site config is
  fetched, so a template closing over `siteStore.title` and registered once would keep whatever the
  store held at mount. The page title alone no longer forces a recompute either, now that a page with
  no title of its own -- the welcome screen, a path with no page -- has to fall back to the site name
  rather than leaving the tab reading " - Site".
*/
useMeta(() => {
  const siteTitle = siteStore.title
  return {
    titleTemplate: (title) => (title ? `${title} - ${siteTitle}` : siteTitle)
  }
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

/** Sidebar widths, in px: the full nav, and the icon rail it collapses to. */
const SIDEBAR_WIDTH = 255
const SIDEBAR_WIDTH_MINI = 56

const sidebarWidth = computed(() => (isSidebarMini.value ? SIDEBAR_WIDTH_MINI : SIDEBAR_WIDTH))

/**
 * Where the drawer stops overlaying the page and takes its own column. Matches `WDrawer`'s own
 * breakpoint — below it there is no seam to straddle, because the sidebar is not beside anything.
 */
const isWideViewport = useMinWidth(1024)

/*
  The scroll-to-top button straddles the seam between the sidebar and the content, half over each, so
  its centre is the sidebar's inner edge — which is the sidebar's width on the left, or the same
  distance in from the right when the site puts its sidebar there.

  Null puts it back in the corner, for every case where there is no seam: a narrow viewport (the
  drawer overlays the page), a site with no sidebar, and the editor, which closes the sidebar to take
  the full width.
*/
const scrollerAnchorX = computed(() => {
  if (!isWideViewport.value || !isSidebarShown.value || siteStore.theme.sidebarPosition === 'off') {
    return null
  }
  return siteStore.theme.sidebarPosition === 'right'
    ? `calc(100% - ${sidebarWidth.value}px)`
    : `${sidebarWidth.value}px`
})

// -> The "Allow Browsing" site feature (admin/general): with it off the tree browser is not something
//    a reader can reach, so the button that opens it does not render
const canBrowse = computed(() => siteStore.features.browse)

// -> The action bar holds only the locale menu and Browse; with both off it would be an empty strip
const showSidebarActions = computed(() => siteStore.locales.showMenu || canBrowse.value)

// -> Saving from this menu needs manage:navigation, so offering it to anyone else only produces a
//    permission error once they press Save
const canEditNav = computed(() => {
  return userStore.authenticated && userStore.can('manage:navigation')
})
</script>

<style lang="scss">
.sidebar-actions {
  background: linear-gradient(to bottom, rgba(255, 255, 255, 0.1) 0%, rgba(0, 0, 0, 0.05) 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.2);
  height: 38px;

  // -> Where the two buttons above get their colour, so neither carries a `color` prop: `WBtn` emits
  //    an inline `color`, which would outrank this rule
  .w-btn {
    color: rgba(255, 255, 255, 0.8);
  }
}

.sidebar-mini {
  height: 100%;
}

/*
  No background of its own, and nothing sticky: the drawer is the height of the shell and the nav list
  above scrolls inside itself, so this bar sits at the bottom of the window by being last in the
  column. WBar's own translucent tint is what colours it -- the `background-color` that used to be
  declared here never applied, its scoped rule outranking a single class.
*/
.sidebar-footerbtns {
  flex-shrink: 0;
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
