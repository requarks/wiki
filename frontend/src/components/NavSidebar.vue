<template>
  <w-scroll-area class="sidebar-nav" :thumb-style="thumbStyle" :bar-style="barStyle">
    <w-list class="sidebar-nav-list" clickable dense dark>
      <template v-for="item of siteStore.nav.items" :key="item.id">
        <w-item-label class="sidebar-nav-header text-caption text-wordbreak-all" v-if="item.type === `header`" header>{{ item.label }}</w-item-label>
        <w-expansion-item v-else-if="item.type === `link` && item.children?.length > 0" dense>
          <!-- The icon goes through a header slot rather than the `icon` prop, so that an Iconify -->
          <!-- reference is drawn by w-icon like everywhere else -->
          <template #header>
            <w-item-section side><w-icon :name="item.icon" color="white" /></w-item-section>
            <w-item-section class="text-wordbreak-all text-white">{{ item.label }}</w-item-section>
          </template>
          <w-list clickable dense dark>
            <w-item v-for="itemChild of item.children" :to="itemChild.target" :key="itemChild.id">
              <w-item-section side><w-icon :name="itemChild.icon" color="white" /></w-item-section>
              <w-item-section class="text-wordbreak-all text-white">{{ itemChild.label }}</w-item-section>
            </w-item>
          </w-list>
        </w-expansion-item>
        <w-item v-else-if="item.type === `link`" :to="item.target">
          <w-item-section side><w-icon :name="item.icon" color="white" /></w-item-section>
          <w-item-section class="text-wordbreak-all text-white">{{ item.label }}</w-item-section>
        </w-item>
        <w-separator v-else-if="item.type === `separator`" dark />
      </template>
    </w-list>
  </w-scroll-area>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'


// STORES

const pageStore = usePageStore()
const siteStore = useSiteStore()

// ROUTER

const router = useRouter()
const route = useRoute()

// I18N

const { t } = useI18n()

// DATA

const thumbStyle = {
  right: '2px',
  borderRadius: '5px',
  backgroundColor: '#FFF',
  width: '5px',
  opacity: 0.5
}
const barStyle = {
  backgroundColor: '#000',
  width: '9px',
  opacity: 0.1
}

// WATCHERS

watch(
  () => pageStore.navigationId,
  (newValue) => {
    if (newValue && newValue !== siteStore.nav.currentId) {
      siteStore.fetchNavigation(newValue)
    }
  },
  { immediate: true }
)
</script>

<style lang="scss">
.sidebar-nav {
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  /* -> Fills whatever the drawer's flex column has left over, rather than subtracting the action bar
     and footer bar by hand: both are conditional, so a fixed `calc()` left dead space at the bottom
     for an anonymous reader (no footer bar) and for a site with no action bar at all. `min-height: 0`
     is what lets it shrink below its content so the scroll area actually scrolls. */
  flex: 1 1 0;
  min-height: 0;

  &-list > .w-separator {
    margin-top: 10px;
    margin-bottom: 10px;
  }

  /*
    A first item that is a link -- on its own or as a group with children -- needs the space a first
    header brings with it. A dense row's padding is 2px, so its label started hard against the rule under
    the site header; a header's own `p-4` already stands it 16px clear, which is why this is only for the
    two link shapes and not for every first child.
  */
  &-list > .w-item:first-child,
  &-list > .w-expansion-item:first-child {
    margin-top: 10px;
  }

  .w-list {
    .w-separator + .w-item-label {
      padding-top: 10px;
    }

    /* -> Full white, like the icons and labels this sidebar sets by hand: the chevron is what says the
       row opens, so it is not the secondary content a trailing section is dimmed for. Set on the icon
       rather than on its section, which is what makes it beat the inherited dimmed colour. */
    .w-expansion-item__arrow {
      color: #fff;
    }

    .w-item-section--avatar {
      min-width: auto;
    }

    /*
      An open group's children, marked the way `NavEditOverlay` marks a nested nav item: a 10px rule down
      the side of the run, with an elbow at each end turning it out of the row above and closing it under
      the last child. The same three pieces and the same 10px, so the two views of one navigation tree
      look like the same tree.

      The rules this replaces addressed `.q-expansion-item__container` and `.q-expansion-item--expanded`,
      which is markup `WExpansionItem` has never emitted -- it renders `__header` and `__content` and
      keeps its state in `aria-expanded`. So none of them matched, and an open group had no line at all.

      No expanded/collapsed state needed here: the content is `v-show`n, so when the group is closed this
      box is `display: none` and takes its border and both elbows with it.
    */
    .w-expansion-item__content {
      position: relative;
      border-left: 10px solid rgba(255, 255, 255, 0.25);
      /*
        And a step DOWN from the sidebar rather than up, which is the one place this parts company with
        `NavEditOverlay`: there the nested rows lift off a near-black panel, here they sit in a coloured
        one, and a lighter wash on a mid-tone blue reads as a highlight -- as if the whole group were
        selected.

        A translucent black, not a colour: the sidebar's own is the site's to choose (`--q-sidebar`,
        rewritten at runtime for per-site theming), so anything fixed would be right for the default blue
        and wrong for every other site.

        `padding-box` keeps that wash off the border area. The rule there is 25% white, and with the
        default `border-box` clip the darkened wash behind it would leave the rule a different colour
        along the children than at the two elbows, which have nothing behind them.
      */
      background-color: rgb(0 0 0 / 0.12);
      background-clip: padding-box;

      /*
        Each elbow is one 10px box showing two of its borders: the mitre between them is the angle. Set
        10px outside the content on the appropriate side, so the vertical stroke lines up with the rule
        and continues it. `left: -10px` is the rule's own left edge -- an absolute offset here is
        measured from the padding box, which starts where the border ends.
      */
      &::before,
      &::after {
        content: '';
        display: block;
        position: absolute;
        left: -10px;
        width: 10px;
        height: 10px;
        border-style: solid;
      }

      /* -> Out of the parent row: the rule's top end, turning right into the row above it */
      &::before {
        top: -10px;
        border-width: 0 10px 10px 0;
        border-color: transparent transparent rgba(255, 255, 255, 0.25) rgba(255, 255, 255, 0.25);
      }

      /* -> And closed under the last child, turning right again */
      &::after {
        top: 100%;
        border-width: 10px 10px 10px 0;
        border-color: rgba(255, 255, 255, 0.25) transparent transparent rgba(255, 255, 255, 0.25);
      }
    }
  }

  &-header {
    color: rgba(255, 255, 255, 0.75) !important;
    /* -> WItemLabel's uniform `p-4` leaves the heading floating between its own group and the one
       above it; tightening the bottom side ties it to the links it labels */
    padding-bottom: 4px;
  }
}
</style>
