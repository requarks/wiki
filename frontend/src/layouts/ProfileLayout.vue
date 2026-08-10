<template>
  <w-layout>
    <w-header>
      <header-nav />
    </w-header>
    <w-page-container class="layout-profile">
      <div class="layout-profile-card">
        <div class="layout-profile-sd">
          <w-list>
            <template v-for="navItem of sidenav" :key="navItem.key">
              <w-item
                v-if="!navItem.disabled || flagsStore.experimental"
                clickable
                :to="`/_profile/` + navItem.key"
                active-class="is-active"
                :disabled="navItem.disabled">
                <w-item-section side>
                  <w-icon :name="navItem.icon" />
                </w-item-section>
                <w-item-section>
                  <w-item-label>{{ navItem.label }}</w-item-label>
                </w-item-section>
              </w-item>
            </template>
            <template v-if="flagsStore.experimental">
              <w-separator inset spaced="sm" />
              <w-item clickable :to="`/_user/` + userStore.id">
                <w-item-section side>
                  <w-icon name="la:id-card" />
                </w-item-section>
                <w-item-section>
                  <w-item-label>{{ t('profile.viewPublicProfile') }}</w-item-label>
                </w-item-section>
              </w-item>
            </template>
            <w-separator inset spaced="sm" />
            <w-item clickable @click="userStore.logout()">
              <w-item-section side>
                <w-icon name="la:sign-out-alt" color="negative" />
              </w-item-section>
              <w-item-section>
                <w-item-label class="text-negative">{{ t('common.header.logout') }}</w-item-label>
              </w-item-section>
            </w-item>
          </w-list>
        </div>
        <router-view />
      </div>
      <w-footer>
        <footer-nav />
      </w-footer>
    </w-page-container>
    <main-overlay-dialog />
  </w-layout>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { onMounted, reactive, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { useMeta } from '@/composables/meta'

import { useFlagsStore } from '@/stores/flags'
import { useSiteStore } from '@/stores/site'
import { useUserStore } from '@/stores/user'

import HeaderNav from '@/components/HeaderNav.vue'
import FooterNav from '@/components/FooterNav.vue'
import MainOverlayDialog from '@/components/MainOverlayDialog.vue'

// STORES

const flagsStore = useFlagsStore()
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
    titleTemplate: (title) => `${title} - ${t('profile.title')} - ${siteTitle}`
  }
})

// DATA

const sidenav = [
  {
    key: 'info',
    label: t('profile.title'),
    icon: 'la:user-circle'
  },
  {
    key: 'avatar',
    label: t('profile.avatar'),
    icon: 'la:otter'
  },
  {
    key: 'auth',
    label: t('profile.auth'),
    icon: 'la:key'
  },
  {
    key: 'groups',
    label: t('profile.groups'),
    icon: 'la:users'
  },
  {
    key: 'notifications',
    label: t('profile.notifications'),
    icon: 'la:bell',
    disabled: true
  },
  // {
  //   key: 'pages',
  //   label: 'My Pages',
  //   icon: 'la:file-alt',
  //   disabled: true
  // },
  {
    key: 'activity',
    label: t('profile.activity'),
    icon: 'la:history',
    disabled: true
  }
]

// WATCHERS

watch(
  () => route.path,
  async (newValue) => {
    if (!newValue.startsWith('/_profile')) {
      return
    }
    if (!userStore.authenticated) {
      router.replace('/login')
    }
  },
  { immediate: true }
)
</script>

<style lang="scss">
.layout-profile {
  @at-root .body--light & {
    background-color: $grey-3;
  }
  @at-root .body--dark & {
    background-color: $dark-6;
  }

  &:before {
    content: '';
    height: 350px;
    position: fixed;
    top: 0;
    width: 100%;
    background: radial-gradient(ellipse at bottom, $dark-3, $dark-6);
    border-bottom: 1px solid #fff;

    @at-root .body--dark & {
      border-bottom-color: $dark-3;
    }
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
    width: 90%;
    max-width: 1400px;
    margin: 50px auto;
    box-shadow: $shadow-2;
    border-radius: 7px;
    display: flex;
    align-items: stretch;
    /*
      No height of its own. The card is a flex item of the scrolling page container, which grows it
      into the height left over beside its 50px margins and lets it grow past that with its content --
      so both the "short page, card fills the window" and "long page, card extends and scrolls" cases
      fall out of the parent.

      It used to say `min-height: calc(100% - 100px)`, subtracting those margins from the box by hand
      (itself the successor to a per-page `style-fn` that computed `height - 100 - offset` in JS). That
      is what a percentage cannot do once a footer shares the box: 100% is the WHOLE of it, footer
      included, so the card claimed the footer's height too and its own content spilled out the bottom.
    */

    /*
      A foreground to go with the background.

      This card is a plain div rather than a WCard, and a WCard is what declares BOTH halves of a
      surface. Setting only the background meant everything inside inherited the document's black --
      row titles, input values, select values alike -- which is invisible against the dark surface.
      The light value is the black it was already inheriting, so only dark mode changes.
    */
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

        // -> Same lightened brand blue as the section headings; `$primary` is too dim on this surface
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

  .actions-bar {
    display: flex;
    padding: 16px;
    background:
      linear-gradient(to right, #fff, transparent),
      linear-gradient(to bottom, rgba($secondary, 0.1), transparent);
    justify-content: flex-end;
    position: relative;

    @at-root .body--dark & {
      background:
        linear-gradient(to right, $dark-3, transparent),
        linear-gradient(to bottom, rgba($secondary, 0.1), transparent);
    }

    &:before {
      content: '';
      width: 100%;
      height: 10px;
      background:
        linear-gradient(to right, #fff, transparent),
        linear-gradient(to top, rgba($secondary, 0.05), transparent);
      position: absolute;
      top: -13px;
      left: 0;
      z-index: 0;

      @at-root .body--dark & {
        background:
          linear-gradient(to right, $dark-3, transparent),
          linear-gradient(to top, rgba($secondary, 0.05), transparent);
      }
    }

    &:after {
      content: '';
      width: 100%;
      height: 1px;
      background: linear-gradient(to right, transparent, rgba($secondary, 0.25));
      position: absolute;
      top: -2px;
      left: 0;
      z-index: 0;
    }
  }
}

body.body--dark {
  background-color: $dark-6;
}

// -> The `.q-footer .q-bar` rule that used to sit here never matched: FooterNav renders
//    `.site-footer`, never a q-bar. The footer's own colours live in FooterNav's scoped style.
</style>
