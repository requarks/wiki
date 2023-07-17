<template lang="pug">
q-scroll-area.sidebar-nav(
  :thumb-style='thumbStyle'
  :bar-style='barStyle'
  )
  q-list(
    clickable
    dense
    dark
    )
    template(v-for='item of siteStore.nav.items')
      q-item-label.text-blue-2.text-caption.text-wordbreak-all(
        v-if='item.type === `header`'
        header
        ) {{ item.label }}
      q-item(
        v-else-if='item.type === `link`'
        :to='item.target'
        )
        q-item-section(side)
          q-icon(:name='item.icon', color='white')
        q-item-section.text-wordbreak-all.text-white {{ item.label }}
      q-separator.q-my-sm(
        v-else-if='item.type === `separator`'
        dark
        )
</template>

<script setup>
import { useQuasar } from 'quasar'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { usePageStore } from 'src/stores/page'
import { useSiteStore } from 'src/stores/site'

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
  if (newValue !== siteStore.nav.currentId) {
    siteStore.fetchNavigation(newValue)
  }
}, { immediate: true })

</script>

<style lang="scss">
.sidebar-nav {
  border-top: 1px solid rgba(255,255,255,.15);
  height: calc(100% - 38px - 24px);

  .q-list {
    .q-separator + .q-item__label {
      padding-top: 12px;
    }
  }
}
</style>
