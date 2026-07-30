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

  .w-list {
    .w-separator + .w-item-label {
      padding-top: 10px;
    }

    .w-item-section--avatar {
      min-width: auto;
    }

    .q-expansion-item > .q-expansion-item__container {
      > .w-item {
        &::before {
          content: '';
          display: block;
          position: absolute;
          bottom: 0;
          left: 0px;
          width: 10px;
          height: 10px;
          border-style: solid;
          border-color: transparent transparent rgba(255, 255, 255, 0.25) rgba(255, 255, 255, 0.25);
          transition: all 0.4s ease;
        }
      }

      &::after {
        content: '';
        display: block;
        position: absolute;
        bottom: -20px;
        left: 0;
        width: 10px;
        height: 10px;
        border-style: solid;
        border-color: rgba(255, 255, 255, 0.25) transparent transparent rgba(255, 255, 255, 0.25);
        transition: all 0.4s ease;
      }
    }

    .q-expansion-item--collapsed > .q-expansion-item__container {
      > .w-item {
        &::before {
          border-width: 0 0 0 0;
        }
      }

      &::after {
        bottom: 0px;
        border-width: 0 0 0 0;
      }
    }

    .q-expansion-item--expanded > .q-expansion-item__container {
      > .w-item {
        &::before {
          border-width: 0 10px 10px 0;
        }
      }

      &::after {
        bottom: -20px;
        border-width: 10px 10px 10px 0;
      }
    }

    .q-expansion-item__content {
      border-left: 10px solid rgba(255, 255, 255, 0.25);
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
