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
    q-item-label.text-blue-2.text-caption(header) Header
    q-item(to='/install')
      q-item-section(side)
        q-icon(name='las la-dog', color='white')
      q-item-section Link 1
    q-item(to='/install')
      q-item-section(side)
        q-icon(name='las la-cat', color='white')
      q-item-section Link 2
    q-separator.q-my-sm(dark)
    q-item(to='/install')
      q-item-section(side)
        q-icon(name='mdi-fruit-grapes', color='white')
      q-item-section.text-wordbreak-all Link 3
</template>

<script setup>
import { useQuasar } from 'quasar'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

import { useSiteStore } from 'src/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

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
