<template lang="pug">
q-scroll-area.sidebar-nav(
  :thumb-style='thumbStyle'
  :bar-style='barStyle'
  )
  q-list.sidebar-nav-list(
    clickable
    dense
    )
    template(v-for='item of siteStore.nav.items', :key='item.id')
      q-item-label.sidebar-nav-header(
        v-if='item.type === `header`'
        header
        ) {{ item.label }}
      q-expansion-item.sidebar-nav-expand(
        v-else-if='item.type === `link` && item.children?.length > 0'
        :icon='item.icon'
        :label='item.label'
        dense
        )
        q-list(
          clickable
          dense
          )
          q-item(
            v-for='itemChild of item.children'
            :to='itemChild.target'
            :key='itemChild.id'
            )
            q-item-section.text-wordbreak-all {{ itemChild.label }}
      q-item(
        v-else-if='item.type === `link`'
        :to='item.target'
        )
        q-item-section(side)
          q-icon(:name='item.icon')
        q-item-section.text-wordbreak-all {{ item.label }}
      q-separator.sidebar-nav-sep(
        v-else-if='item.type === `separator`'
        )
</template>

<script setup>
import { useQuasar } from 'quasar'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { usePageStore } from '@/stores/page'
import { useSiteStore } from '@/stores/site'

const $q = useQuasar()
const pageStore = usePageStore()
const siteStore = useSiteStore()
const router = useRouter()
const route = useRoute()
const { t } = useI18n()

const thumbStyle = {
  right: '2px',
  borderRadius: '3px',
  backgroundColor: '#CBD5E1',
  width: '4px',
  opacity: 0.6
}
const barStyle = {
  backgroundColor: 'transparent',
  width: '8px',
  opacity: 0.1
}

watch(() => pageStore.navigationId, (newValue) => {
  if (newValue && newValue !== siteStore.nav.currentId) {
    siteStore.fetchNavigation(newValue)
  }
}, { immediate: true })

</script>

<style lang="scss">
.sidebar-nav {
  height: 100%;

  &-list > .q-separator {
    margin: 8px 16px;
    background: #E2E8F0;
  }

  &-header {
    color: #94A3B8 !important;
    font-size: 0.7rem !important;
    font-weight: 600 !important;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    padding: 16px 16px 6px !important;
  }

  &-expand {
    .q-expansion-item__container > .q-item {
      padding: 6px 12px;
      margin: 1px 8px;
      border-radius: 6px;
      min-height: 34px;
      color: #334155;
      font-weight: 500;
      font-size: 0.875rem;

      .q-icon { font-size: 18px; color: #94A3B8; }

      &:hover {
        background: #F1F5F9;
      }
    }

    .q-expansion-item__content {
      border-left: none;
      padding-left: 12px;

      .q-item {
        padding: 4px 12px 4px 36px;
        margin: 1px 8px;
        border-radius: 6px;
        min-height: 30px;
        font-size: 0.825rem;
        color: #64748B;

        &:hover {
          background: #F1F5F9;
          color: #334155;
        }

        &.q-router-link--active {
          background: #E6F1FE;
          color: #006FEE;
          font-weight: 600;
        }
      }
    }
  }

  .q-list > .q-item {
    padding: 6px 12px;
    margin: 1px 8px;
    border-radius: 6px;
    min-height: 34px;
    color: #334155;
    font-size: 0.875rem;

    .q-icon { font-size: 18px; color: #94A3B8; }

    &:hover {
      background: #F1F5F9;
      color: #1E293B;
    }

    &.q-router-link--active {
      background: #E6F1FE !important;
      color: #006FEE !important;
      font-weight: 600;

      .q-icon { color: #006FEE; }
    }
  }
}
</style>
