<template>
  <w-layout>
    <w-header>
      <header-nav />
    </w-header>
    <w-page-container class="layout-inbox">
      <div class="layout-inbox-card">
        <!--
          Below 900px the section list is a disclosure above the content rather than a column beside it,
          as in the profile layout: a 300px rail left a phone nothing for the lists. The bar names the
          section being read, and carries the unread count so it is not hidden behind a closed list.
        -->
        <w-btn
          v-if="isNavCollapsed"
          class="layout-inbox-navbtn"
          flat
          no-caps
          :icon="currentSection.icon"
          :label="currentSection.label"
          :aria-expanded="state.navOpen"
          @click="toggleNav">
          <template #append>
            <span class="inline-flex items-center gap-2">
              <w-badge
                v-if="notificationsStore.badge"
                color="negative"
                rounded
                :label="notificationsStore.badge" />
              <w-icon
                class="layout-inbox-navchevron"
                :class="{ 'is-open': state.navOpen }"
                name="mdi:chevron-down" />
            </span>
          </template>
        </w-btn>
        <div class="layout-inbox-sd" v-show="!isNavCollapsed || state.navOpen">
          <w-list>
            <w-item
              v-for="navItem of sidenav"
              :key="navItem.key"
              clickable
              :to="`/_inbox/` + navItem.key"
              active-class="is-active">
              <w-item-section side>
                <w-icon :name="navItem.icon" />
              </w-item-section>
              <w-item-section>
                <w-item-label>{{ navItem.label }}</w-item-label>
              </w-item-section>
              <w-item-section v-if="navItem.badge" side>
                <w-badge color="negative" rounded :label="navItem.badge" />
              </w-item-section>
            </w-item>
          </w-list>
        </div>
        <router-view />
      </div>
    </w-page-container>
    <main-overlay-dialog />
  </w-layout>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, reactive, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { useMeta } from '@/composables/meta'
import { useMinWidth } from '@/composables/screen'
import { loginLocation } from '@/helpers/loginRedirect'

import { useNotificationsStore } from '@/stores/notifications'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import HeaderNav from '@/components/HeaderNav.vue'
import MainOverlayDialog from '@/components/MainOverlayDialog.vue'

/**
 * The inbox: what has come in for this user, what they are following, and what is waiting on them.
 *
 * Same shape as the profile layout -- dark backdrop, one card, a rail down its left -- but the card
 * fills the viewport rather than sitting in a column, since these sections are lists to work through
 * rather than a form to read.
 */

// STORES

const notificationsStore = useNotificationsStore()
const siteStore = useSiteStore()
const userStore = useUserStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// META

// -> The site's own name rather than the literal `Wiki.js`, as the page view does. A getter, so the
//    template is recomputed when the site config arrives -- see the note in `MainLayout`.
useMeta(() => {
  const siteTitle = siteStore.title
  return {
    titleTemplate: (title) => `${title} - ${t('inbox.title')} - ${siteTitle}`
  }
})

// DATA

/*
  Computed, not a plain array: the locale strings are fetched after the app mounts (`App.vue` ->
  `applyLocale`), so a `t()` called once during `setup()` can resolve before they land and leave
  the section list showing raw keys for the life of the page — which is what a direct load of this
  screen does, as opposed to a navigation to it. Inside a computed it re-evaluates when
  `setLocaleMessage` fills the strings in.
*/
const sidenav = computed(() => [
  {
    key: 'messages',
    label: t('inbox.inbox'),
    icon: 'mdi:inbox-full',
    badge: notificationsStore.badge
  },
  {
    key: 'watching',
    label: t('inbox.watching'),
    icon: 'la:bell'
  },
  {
    key: 'review',
    label: t('inbox.pendingReview'),
    icon: 'la:clipboard-check'
  }
])

const state = reactive({
  /** Whether the section list is open. Only consulted below 900px, where it is a disclosure. */
  navOpen: false
})

// COMPUTED

/**
 * Below 900px, where the rail becomes a disclosure above the content. The same boundary as the profile
 * layout's, for the same reason; `$nav-collapse-max` in the stylesheet is this from the other side.
 */
const isAtLeast900 = useMinWidth(900)
const isNavCollapsed = computed(() => !isAtLeast900.value)

/** The section being read, which the collapsed bar is labelled with. The inbox for anything else. */
const currentSection = computed(
  () => sidenav.value.find((item) => route.path === `/_inbox/${item.key}`) ?? sidenav.value[0]
)

// WATCHERS

// -> There is nothing in here for somebody with no account, and every section is about them
watch(
  () => route.path,
  (newValue) => {
    // -> Picking a section is what the open list is for, so arriving at one puts it away again
    state.navOpen = false
    if (newValue.startsWith('/_inbox') && !userStore.authenticated) {
      router.replace(loginLocation(route.fullPath))
    }
  },
  { immediate: true }
)

// METHODS

function toggleNav() {
  state.navOpen = !state.navOpen
}
</script>

<style lang="scss">
/*
  The backdrop and the rail are the profile layout's, deliberately: these are the two places in the
  app a signed in person manages their own things, and they should read as the same place.

  What differs is the card. The profile card is a centred column of forms; this one is a workspace of
  lists, so it takes the whole viewport less a margin.

  `$nav-collapse-max` has to agree with the 900px `useMinWidth` above, which decides whether the
  disclosure button is rendered at all.
*/
$nav-collapse-max: 899.98px;
$nav-shrink-max: 1199.98px;

.layout-inbox {
  // -> Dark in both themes, unlike the profile layout: there is no light half here for a light theme
  //    to own, so the surface is the same either way
  background-color: $dark-6;

  /*
    The profile layout's gradient, stretched over the whole viewport instead of a band across the top.
    There it fades into a light page below it, which is what the 350px height and the border were for;
    with nothing to fade into, both go.
  */
  &:before {
    content: '';
    position: fixed;
    inset: 0;
    background: radial-gradient(ellipse at bottom, $dark-3, $dark-6);
  }

  &:after {
    content: '';
    height: 1px;
    position: fixed;
    top: 64px;
    width: 100%;
    background: linear-gradient(
      to right,
      transparent 0%,
      rgba(255, 255, 255, 0.1) 50%,
      transparent 100%
    );
  }

  &-card {
    position: relative;
    margin: 16px;
    box-shadow: $shadow-2;
    border-radius: 7px;
    display: flex;
    align-items: stretch;
    // -> No height of its own: the scrolling page container grows this into what is left beside the
    //    16px margins above, and lets its content take it past that. See `.layout-profile-card`.

    @at-root .body--light & {
      background-color: #fff;
      color: var(--color-black);
    }
    @at-root .body--dark & {
      background-color: $dark-3;
      color: var(--color-white);
    }
  }

  &-sd {
    flex: 0 0 300px;
    border-radius: 8px 0 0 8px;
    overflow: hidden;

    @at-root .body--light & {
      background-color: $grey-1;
      border-right: 1px solid rgba($dark-3, 0.1);
      box-shadow: inset -1px 0 0 #fff;
    }
    @at-root .body--dark & {
      background-color: $dark-4;
      border-right: 1px solid rgba(#fff, 0.12);
      box-shadow: inset -1px 0 0 rgba($dark-6, 0.5);
    }

    .w-list .w-item {
      font-weight: 500;
      color: $grey-9;

      @at-root .body--dark & {
        color: rgba(255, 255, 255, 0.75);
      }

      &.is-active {
        background: linear-gradient(to bottom, rgba($primary, 0.25), rgba($primary, 0.1));
        color: $primary;

        // -> WIcon draws an Iconify reference as <iconify-icon> and anything else via q-icon
        .w-icon,
        iconify-icon {
          color: $primary;
        }

        @at-root .body--dark & {
          color: var(--color-primary-light);

          .w-icon,
          iconify-icon {
            color: var(--color-primary-light);
          }
        }
      }
    }
  }

  .w-page {
    flex: 1 1;

    @at-root .body--light & {
      border-left: 1px solid #fff;
    }
    @at-root .body--dark & {
      border-left: 1px solid rgba($dark-6, 0.75);
    }
  }

  /*
    NARROWER LAYOUTS
    ================

    The profile layout's three steps, less the gutters: this card already sits 16px from the edges.

      below 1200px   the rail shrinks from 300px to the width of its own labels
      below 900px    the rail becomes a disclosure above the content
      below 600px    the card stops being a sheet and becomes the screen

    Narrowest last, so each block overrides the one above it.
  */

  @media (max-width: $nav-shrink-max) {
    &-sd {
      flex: 0 0 auto;
    }
  }

  @media (max-width: $nav-collapse-max) {
    &-card {
      flex-direction: column;
    }

    // -> The top of the card now, so it takes the card's top corners; the count and chevron sit at the
    //    far end from the label
    &-navbtn {
      justify-content: space-between;
      border-radius: 7px 7px 0 0;

      @at-root .body--light & {
        background-color: $grey-1;
        border-bottom: 1px solid $grey-3;
      }
      @at-root .body--dark & {
        background-color: $dark-4;
        border-bottom: 1px solid $dark-2;
      }
    }

    &-navchevron {
      transition: transform 0.2s var(--ease-standard);

      &.is-open {
        transform: rotate(180deg);
      }
    }

    // -> Per theme, because that is where the rules being replaced are declared
    &-sd {
      flex: none;
      width: 100%;
      border-radius: 0;

      @at-root .body--light & {
        border-right: 0;
        border-bottom: 1px solid $grey-3;
        box-shadow: none;
      }
      @at-root .body--dark & {
        border-right: 0;
        border-bottom: 1px solid rgba(#fff, 0.12);
        box-shadow: none;
      }
    }

    .w-page {
      @at-root .body--light & {
        border-left: 0;
      }
      @at-root .body--dark & {
        border-left: 0;
      }
    }
  }

  @media (max-width: $breakpoint-xs-max) {
    &-card {
      margin: 0;
      border-radius: 0;
      box-shadow: none;
    }

    &-navbtn {
      border-radius: 0;
    }
  }
}

body.body--dark {
  background-color: $dark-6;
}
</style>
