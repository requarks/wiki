<template>
  <w-page class="py-4">
    <div class="w-section-header">{{ t('inbox.watching') }}</div>
    <div class="p-4">
      <div class="text-body2">{{ t('inbox.watchingInfo') }}</div>
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { useMeta } from '@/composables/meta'

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('inbox.watching')
})
</script>
