<template>
  <div class="site-header bg-header text-white">
    <div class="flex flex-nowrap">
      <w-toolbar style="height: 64px">
        <w-btn dense flat :to="homePath">
          <w-avatar v-if="siteStore.logoText" size="34px" square>
            <img :src="`/_site/current/logo`" />
          </w-avatar>
          <img v-else :src="`/_site/current/logo`" style="height: 34px" />
        </w-btn>
        <div v-if="siteStore.logoText" class="site-title text-h6 ml-2 min-w-0 flex-1 truncate">
          {{ siteStore.title }}
        </div>
      </w-toolbar>
      <!-- -> Inline between the title and the actions only where there is room for all three; on a
              phone the field gets a row of its own at the bottom of this header instead -->
      <header-search v-if="!isSearchCollapsed" />
      <w-toolbar style="height: 64px">
        <w-space />
        <transition name="syncing">
          <w-spinner v-show="commonStore.routerLoading" size="20px" class="text-accent" />
        </transition>
        <!--
          The two halves of the right-hand group collapse at different widths, so they are separate tests
          rather than one phone/desktop switch: the field is the first thing that stops fitting beside the
          site title, and the five buttons hold out for another 300px.
        -->
        <w-btn
          v-if="isSearchCollapsed && siteStore.features.search"
          class="ml-4"
          flat
          round
          dense
          :icon="searchRowIsOpen ? `la:times` : `la:search`"
          color="white"
          :aria-label="searchRowIsOpen ? t(`common.actions.close`) : t(`common.header.search`)"
          :aria-expanded="searchRowIsOpen"
          @click="toggleSearchRow" />
        <!--
          One button for the five. Icon buttons whose meaning is only in a tooltip are not something a
          touch screen can offer at all, and by 900px they are also crowding the site title.
        -->
        <header-actions-menu v-if="isActionsCollapsed" />
        <template v-else>
          <w-btn
            v-if="userStore.can(`write:pages`)"
            class="ml-4"
            flat
            round
            dense
            icon="la:plus-circle"
            color="blue-4"
            aria-label="Create New Page">
            <w-tooltip>Create New Page</w-tooltip>
            <new-menu />
          </w-btn>
          <!--
            -> Whoever may put a file somewhere: `write:assets` outright, or `write:pages` for an
               author whose rules cover the pages but not the assets beside them, since the editor
               sends them here to insert an image. Every folder and every file is checked again by the
               endpoints behind the manager, which answer per path, so this decides only whether the
               door is shown.
          -->
          <w-btn
            v-if="userStore.can(`write:assets`) || userStore.can(`write:pages`)"
            class="ml-4"
            flat
            round
            dense
            icon="la:folder-open"
            color="positive"
            aria-label="File Manager"
            @click="openFileManager">
            <w-tooltip>File Manager</w-tooltip>
          </w-btn>
          <w-btn
            v-if="userStore.authenticated"
            class="ml-4"
            flat
            round
            dense
            icon="mdi:inbox-full"
            color="amber"
            to="/_inbox"
            :aria-label="t(`inbox.title`)">
            <w-tooltip>{{ t('inbox.title') }}</w-tooltip>
          </w-btn>
          <w-btn
            v-if="userStore.can(`access:admin`)"
            class="ml-4"
            flat
            round
            dense
            icon="la:tools"
            color="pink"
            to="/_admin"
            :aria-label="t(`common.header.admin`)">
            <w-tooltip>{{ t('common.header.admin') }}</w-tooltip>
          </w-btn>

          <!-- USER BUTTON / DROPDOWN -->
          <account-menu v-if="userStore.authenticated" />
          <w-btn
            v-else
            class="ml-4"
            flat
            rounded
            icon="la:sign-in-alt"
            color="white"
            :label="$t(`common.actions.login`)"
            :aria-label="$t(`common.actions.login`)"
            to="/login"
            padding="sm"
            no-caps />
        </template>
      </w-toolbar>
    </div>
    <!--
      The phone search field, in a row of its own under the bar. Unmounted on the way out, so there is
      never a second field bound to the same query.

      Focused from `@after-enter` rather than on mount: focusing the field is what draws the suggestions
      panel under it, and doing that while the row is still sliding put a fresh layout and a
      `backdrop-filter` blur into the middle of the animation -- which is what made it stutter.
    -->
    <transition name="header-search-row" @after-enter="searchRow?.focus()">
      <div v-if="isSearchCollapsed && searchRowIsOpen" class="header-search-row">
        <header-search ref="searchRow" row />
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { useMinWidth } from '@/composables/screen'
import { splitLocalePath } from '@/helpers/pagePaths'

import { useCommonStore } from '@/stores/common'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import AccountMenu from '@/components/AccountMenu.vue'
import NewMenu from '@/components/PageNewMenu.vue'
import HeaderActionsMenu from '@/components/HeaderActionsMenu.vue'
import HeaderSearch from '@/components/HeaderSearch.vue'

/**
 * Site header content.
 *
 * Content only, for the same reason as `FooterNav`: the enclosing layout supplies the header
 * element, so layouts sharing this component can migrate independently.
 */

// STORES

const commonStore = useCommonStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// ROUTER

const route = useRoute()

// I18N

const { t } = useI18n()

// REFS

/** The phone search field, for the one thing this component does to it: focus it once it is down. */
const searchRow = ref(null)

// DATA

/** Whether the phone search row is down. Never consulted above the breakpoint. */
const searchRowIsOpen = ref(false)

// COMPUTED

/**
 * Below the `sm` breakpoint (`css/tailwind.css`), where the search field gives up its place between the
 * site title and the actions and becomes a button that opens a row of its own.
 */
const isAtLeastSm = useMinWidth(600)
/*
  Home, in the locale being read: `/fr/...` goes back to `/fr`, not to the English site root. Taken
  off the route rather than off the page store, because the logo is the way out of a screen where
  there may be no page -- a path with nothing behind it, a locale whose home page is not written yet.
  Empty prefix on a site that does not bracket its URLs, which leaves the root as it was.
*/
const homePath = computed(() => {
  const current = splitLocalePath(route.path, siteStore.localePrefixes)
  return (current && siteStore.localeUrlPrefix(current.locale)) || '/'
})

const isSearchCollapsed = computed(() => !isAtLeastSm.value)

/**
 * Below 900px, where the five action buttons become the one overflow menu.
 *
 * A separate question from the search field above, and a wider one: the field is what stops fitting
 * first, while the buttons are 5 × 40px that only start crowding the title around here. The same 900 the
 * profile and search cards collapse their sidebars at, which is coincidence rather than a shared cause —
 * it is simply where a window stops being a desktop one.
 */
const isAtLeast900 = useMinWidth(900)
const isActionsCollapsed = computed(() => !isAtLeast900.value)

// WATCHERS

/*
  The search row closes on arriving somewhere, which is what pressing Enter in it does: the results are
  the answer, and a field still hanging under the header is one more thing to put away by hand.
*/
watch(
  () => route.path,
  () => {
    searchRowIsOpen.value = false
  }
)

// MOUNTED

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})

// METHODS

/*
  Ctrl+K below 600px, where the field is not mounted and so cannot claim the shortcut itself: this
  opens the row, and `HeaderSearch` focuses on mount. Above the breakpoint, and while the row is
  already down, the field's own handler is the one that answers -- see `HeaderSearch.handleKeyPress`.
*/
function onKeydown(ev) {
  if (!isSearchCollapsed.value || searchRowIsOpen.value || !siteStore.features.search) {
    return
  }
  if (ev.ctrlKey && ev.key === 'k' && !siteStore.overlayIsShown) {
    ev.preventDefault()
    searchRowIsOpen.value = true
  }
}

function toggleSearchRow() {
  searchRowIsOpen.value = !searchRowIsOpen.value
}

function openFileManager() {
  siteStore.openFileManager()
}
</script>

<style scoped lang="scss">
/*
  The site name, a step down on a phone: `text-h6` is 20px, which is a heading's size next to a 34px
  logo and two buttons on a 390px bar. Slight on purpose -- the title is still the first thing the bar
  says.
*/
@media (max-width: $breakpoint-xs-max) {
  .site-title {
    font-size: 1.0625rem;
  }
}

/*
  The site's sidebar colour, which is what says this IS a second row rather than more of the bar: the
  header's colour is the site's to choose and is black by default, so against an identical black the
  field read as a pill floating in one tall bar -- generously padded above and cropped below.

  The sidebar's rather than any other: on a phone the sidebar is the panel this same header opens, so the
  two things that come out from behind the bar are the one colour.

  Through `--color-sidebar` rather than the `bg-sidebar` utility, so the row follows a site that themes
  its colours at runtime (the variable is rewritten in place; see `tailwind.css`).
*/
.header-search-row {
  background-color: var(--color-sidebar);
}

/*
  The search row sliding out from under the bar.

  `max-height` rather than `height`, because the row is a `WToolbar` and carries `min-height: 50px` of
  its own -- which a height of 0 loses to, and a max-height overrules. 52px is the height the row is
  given in `HeaderSearch`; the two have to agree, or the slide stops short of the row's full height and
  jumps the rest of the way.

  `overflow: hidden` for the duration only, so that the search panel -- which hangs BELOW this row and
  is positioned against it -- is not clipped once the row is open.
*/
.header-search-row-enter-active,
.header-search-row-leave-active {
  overflow: hidden;
  transition:
    max-height 0.2s var(--ease-standard),
    opacity 0.2s var(--ease-standard);
}
.header-search-row-enter-from,
.header-search-row-leave-to {
  max-height: 0;
  opacity: 0;
}
.header-search-row-enter-to,
.header-search-row-leave-from {
  max-height: 52px;
}

@media (prefers-reduced-motion: reduce) {
  .header-search-row-enter-active,
  .header-search-row-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
