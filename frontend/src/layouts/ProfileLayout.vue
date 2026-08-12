<template>
  <w-layout>
    <w-header>
      <header-nav />
    </w-header>
    <w-page-container class="layout-profile">
      <div class="layout-profile-card">
        <!--
          Below 900px the section list is a disclosure rather than a column beside the content: even shrunk
          to its own labels it is ~240px, and on a phone the fixed 300px of it left the content overflowing
          the card and clipped at the edge of the screen. Closed to start with, and it names the section
          being read -- so the bar that opens the nav is also what says where in the profile the reader is.
        -->
        <w-btn
          v-if="isNavCollapsed"
          class="layout-profile-navbtn"
          flat
          no-caps
          :icon="currentSection.icon"
          :label="currentSection.label"
          :aria-expanded="state.navOpen"
          @click="toggleNav">
          <w-icon
            class="layout-profile-navchevron"
            :class="{ 'is-open': state.navOpen }"
            name="mdi:chevron-down" />
        </w-btn>
        <div class="layout-profile-sd" v-show="!isNavCollapsed || state.navOpen">
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
import { computed, onMounted, reactive, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import { useMeta } from '@/composables/meta'
import { useMinWidth } from '@/composables/screen'

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

const state = reactive({
  /** Whether the section list is open. Only consulted below 900px, where it is a disclosure. */
  navOpen: false
})

// COMPUTED

/**
 * Below 900px, where the nav stops being a column beside the content and becomes a disclosure above it.
 *
 * This layout's own breakpoint rather than one of the app's: it is the width at which a nav column shrunk
 * to its own labels (~240px, see the stylesheet) is still more than the content can spare. The stylesheet
 * has to agree with it — `$nav-collapse-max` is the same boundary from the other side.
 */
const isAtLeast900 = useMinWidth(900)
const isNavCollapsed = computed(() => !isAtLeast900.value)

/**
 * The section being read, which is what the collapsed nav bar is labelled with.
 *
 * Falls back to the profile's own name for a path the list does not cover — the public profile, or a
 * `/_profile` with no section — so the bar always says something.
 */
const currentSection = computed(() => {
  return (
    sidenav.find((item) => route.path === `/_profile/${item.key}`) ?? {
      label: t('profile.title'),
      icon: 'la:user-circle'
    }
  )
})

// WATCHERS

watch(
  () => route.path,
  async (newValue) => {
    // -> Picking a section is what the open list is for, so arriving at one puts it away again
    state.navOpen = false
    if (!newValue.startsWith('/_profile')) {
      return
    }
    if (!userStore.authenticated) {
      router.replace('/login')
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
  Where this card's two desktop assumptions give out. Both are its own, not the app's -- see the comment
  on the media queries at the bottom of this block. Stated as `max` values, just under the width the next
  layout up starts at, the way `_palette.scss` states the shared ones.

  `$nav-collapse-max` has to agree with the 900px `useMinWidth` above it, which is what decides whether
  the disclosure button is rendered at all.
*/
$nav-collapse-max: 899.98px;
$nav-shrink-max: 1199.98px;

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

  /*
    THREE NARROWER LAYOUTS
    ======================

    This card is a sheet floating in a tinted page -- 90% of the width, 50px of gutter all round -- with a
    300px nav column down its left side. Both of those are pitched for a desktop window, and they give out
    at three different widths, so the card gives them up one at a time rather than all at once:

      below 1200px   the nav column stops being 300px wide and shrinks to its own labels, and the card's
                     gutters halve -- both of which hand the content back the width it is running out of
      below 900px    the nav column goes altogether and becomes a disclosure above the content, because
                     even shrunk to its labels it is ~240px that the content needs more; the settings rows
                     are still two columns here, which is the point of taking the nav out rather than
                     stacking them
      below 600px    the card stops being a sheet and becomes the screen, and the rows stack

    Ordered narrowest-last, so each block overrides the one above it where the two speak about the same
    property. `$nav-*-max` are this layout's own -- deliberately not in `_palette.scss`, which is for
    breakpoints the whole app shares: these two describe when THIS card runs out of room, which is a
    function of its own nav column and of nothing else.
  */

  /* --- Below 1200px: the nav gives up its fixed width, the card gives up half its gutters ----------- */
  @media (max-width: $nav-shrink-max) {
    /*
      Halved from `90% / 50px`. Deliberately not bracketed to the 900-1200 band: below 900 the gutters
      would otherwise JUMP back to the wider pair as the window narrows, which is the one thing a reader
      resizing a window would actually notice.
    */
    &-card {
      width: 95%;
      margin: 25px auto;
    }

    /* -> `auto` basis: the column is as wide as its longest label needs, instead of 300px regardless */
    &-sd {
      flex: 0 0 auto;
    }
  }

  /* --- Below 900px: the nav is a disclosure above the content ------------------------------------- */
  @media (max-width: $nav-collapse-max) {
    &-card {
      flex-direction: column;
    }

    /*
      The disclosure's bar. Full width, with the chevron pushed to the far end from the label, and the
      card's own top corners -- it is the top of the card now, so it is what has to be rounded to it.
    */
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

    /* -> The button's whole content is one flex row, so the chevron needs pushing to the end of it */
    &-navbtn > span {
      flex: 1;
      justify-content: space-between;
    }

    &-navchevron {
      transition: transform 0.2s var(--ease-standard);

      &.is-open {
        transform: rotate(180deg);
      }
    }

    /*
      The nav, no longer a column at all: the width of the card, with the seam that divided the two columns
      moving from its right edge to its bottom one. Per theme, because that is where the rules being
      replaced are declared -- at three classes each, which a plain override here would lose to.
    */
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

    /* -> The seam is the nav's bottom border now, and a left one would draw down the content's own edge */
    .w-page {
      @at-root .body--light & {
        border-left: 0;
      }
      @at-root .body--dark & {
        border-left: 0;
      }
    }
  }

  /* --- Below 600px: the card is the screen, and a settings row stacks ----------------------------- */
  @media (max-width: $breakpoint-xs-max) {
    &-card {
      width: 100%;
      margin: 0;
      border-radius: 0;
      box-shadow: none;
    }

    /* -> Nothing left to round: the card's own corners are square here */
    &-navbtn {
      border-radius: 0;
    }

    /*
      A settings row stacks: its label and its field are two MAIN sections, which share the row's width
      equally -- 175px each on this screen, too narrow for either. The field takes a line of its own under
      the label it belongs to, full width, and the 8px gutter between two columns becomes the gap between
      two lines.

      Scoped to `.w-page`, the content column: the nav's own rows are a side section and a main one, which
      have no reason to wrap and would only be loosened by this.
    */
    .w-page .w-item {
      flex-wrap: wrap;
    }

    /*
      `flex-basis`, not `width`: the section carries Tailwind's `flex-1`, which is `flex: 1 1 0%` -- and a
      flex item is sized by its basis, so a width of 100% was simply ignored and the two sections went on
      sharing the line. 100% is wider than the row can fit beside anything, which is what pushes it onto a
      line of its own.
    */
    .w-page .w-item-section--main + .w-item-section--main {
      flex: 1 0 100%;
      margin-top: 0.5rem;
      margin-left: 0;
    }
  }
}

body.body--dark {
  background-color: $dark-6;
}

// -> The `.q-footer .q-bar` rule that used to sit here never matched: FooterNav renders
//    `.site-footer`, never a q-bar. The footer's own colours live in FooterNav's scoped style.
</style>
