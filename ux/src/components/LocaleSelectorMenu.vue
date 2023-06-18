<template lang="pug">
q-menu.translucent-menu(
  auto-close
  anchor='bottom middle'
  self='top left'
  )
  q-list(padding, style='min-width: 200px;')
    q-item(
      v-for='lang of siteStore.locales.active'
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

import { useCommonStore } from 'src/stores/common'
import { useSiteStore } from 'src/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

const commonStore = useCommonStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// METHODS

</script>
