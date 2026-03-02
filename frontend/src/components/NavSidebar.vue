<template lang="pug">
q-scroll-area.sidebar-nav(
  :thumb-style='thumbStyle'
  :bar-style='barStyle'
  )
  q-list.sidebar-nav-list(
    clickable
    dense
    dark
    )
    template(v-for='item of siteStore.nav.items', :key='item.id')
      q-item-label.sidebar-nav-header.text-caption.text-wordbreak-all(
        v-if='item.type === `header`'
        header
        ) {{ item.label }}
      q-expansion-item(
        v-else-if='item.type === `link` && item.children?.length > 0'
        :icon='item.icon'
        :label='item.label'
        dense
        )
        q-list(
          clickable
          dense
          dark
          )
          q-item(
            v-for='itemChild of item.children'
            :to='itemChild.target'
            :key='itemChild.id'
            )
            q-item-section(side)
              q-icon(:name='itemChild.icon', color='white')
            q-item-section.text-wordbreak-all.text-white {{ itemChild.label }}
      q-item(
        v-else-if='item.type === `link`'
        :to='item.target'
        )
        q-item-section(side)
          q-icon(:name='item.icon', color='white')
        q-item-section.text-wordbreak-all.text-white {{ item.label }}
      q-separator(
        v-else-if='item.type === `separator`'
        dark
        )
</template>

<script setup>
import { useQuasar } from 'quasar'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

// QUASAR

const $q = useQuasar()

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

watch(() => pageStore.navigationId, (newValue) => {
  if (newValue && newValue !== siteStore.nav.currentId) {
    siteStore.fetchNavigation(newValue)
  }
}, { immediate: true })

</script>

<style lang="scss">
.sidebar-nav {
  border-top: 1px solid rgba(255,255,255,.15);
  height: calc(100% - 38px - 24px);

  &-list > .q-separator {
    margin-top: 10px;
    margin-bottom: 10px;
  }

  .q-list {
    .q-separator + .q-item__label {
      padding-top: 10px;
    }

    .q-item__section--avatar {
      min-width: auto;
    }

    .q-expansion-item > .q-expansion-item__container {
      > .q-item {
        &::before {
          content: '';
          display: block;
          position: absolute;
          bottom: 0;
          left: 0px;
          width: 10px;
          height: 10px;
          border-style: solid;
          border-color: transparent transparent rgba(255,255,255,.25) rgba(255,255,255,.25);
          transition: all .4s ease;
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
        border-color: rgba(255,255,255,.25) transparent transparent rgba(255,255,255,.25);
        transition: all .4s ease;
      }
    }

    .q-expansion-item--collapsed > .q-expansion-item__container {
      > .q-item {
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
      > .q-item {
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
      border-left: 10px solid rgba(255,255,255,.25);
    }
  }

  &-header {
    color: rgba(255,255,255,.75) !important;
  }
}
</style>
