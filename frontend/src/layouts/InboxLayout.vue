<template>
  <w-layout>
    <w-header>
      <header-nav />
    </w-header>
    <w-page-container class="layout-inbox">
      <div class="layout-inbox-card">
        <div class="layout-inbox-sd">
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
import { watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { useMeta } from '@/composables/meta'

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

const sidenav = [
  {
    key: 'messages',
    label: t('inbox.inbox'),
    icon: 'mdi:inbox-full'
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
]

// WATCHERS

// -> There is nothing in here for somebody with no account, and every section is about them
watch(
  () => route.path,
  (newValue) => {
    if (newValue.startsWith('/_inbox') && !userStore.authenticated) {
      router.replace('/login')
    }
  },
  { immediate: true }
)
</script>

<style lang="scss">
/*
  The backdrop and the rail are the profile layout's, deliberately: these are the two places in the
  app a signed in person manages their own things, and they should read as the same place.

  What differs is the card. The profile card is a centred column of forms; this one is a workspace of
  lists, so it takes the whole viewport less a margin.
*/
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
}

body.body--dark {
  background-color: $dark-6;
}
</style>
