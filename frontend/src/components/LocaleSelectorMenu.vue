<template lang="pug">
q-menu.translucent-menu(
  auto-close
  :anchor='props.anchor'
  :self='props.self'
  :offset='props.offset'
  )
  q-list(padding, style='min-width: 200px;')
    q-item(
      v-for='lang of siteStore.locales.active'
      :key='lang.code'
      clickable
      @click='commonStore.setLocale(lang.code)'
      )
      q-item-section(side)
        q-avatar(rounded, :color='lang.code === commonStore.locale ? `secondary` : `primary`', text-color='white', size='sm')
          .text-caption.text-uppercase: strong {{ lang.language }}
      q-item-section
        q-item-label {{ lang.nativeName }}
        q-item-label(caption) {{ lang.name }}
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useQuasar } from 'quasar'

import { useCommonStore } from '@/stores/common'
import { useSiteStore } from '@/stores/site'

// PROPS

const props = defineProps({
  anchor: {
    type: String,
    default: 'bottom left'
  },
  self: {
    type: String,
    default: 'top left'
  },
  offset: {
    type: Array,
    default: () => ([0, 0])
  }
})

// QUASAR

const $q = useQuasar()

// STORES

const commonStore = useCommonStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// METHODS

</script>
