<template>
  <w-menu
    class="translucent-menu"
    auto-close
    :anchor="props.anchor"
    :self="props.self"
    :offset="props.offset">
    <w-list padding style="min-width: 200px;">
      <w-item
        v-for="lang of siteStore.locales.active"
        :key="lang.code"
        clickable
        @click="commonStore.setLocale(lang.code)">
        <w-item-section side>
          <w-avatar
            rounded
            :color="lang.code === commonStore.locale ? `secondary` : `primary`"
            text-color="white"
            size="sm">
            <div class="text-caption uppercase"><strong>{{ lang.language }}</strong></div>
          </w-avatar>
        </w-item-section>
        <w-item-section>
          <w-item-label>{{ lang.nativeName }}</w-item-label>
          <w-item-label caption>{{ lang.name }}</w-item-label>
        </w-item-section>
      </w-item>
    </w-list>
  </w-menu>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

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
    default: () => [0, 0]
  }
})


// STORES

const commonStore = useCommonStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// METHODS
</script>
