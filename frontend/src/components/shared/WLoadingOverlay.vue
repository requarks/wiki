<template>
  <teleport to="body">
    <transition name="w-loading">
      <div
        v-if="isActive"
        class="w-loading fixed inset-0 z-[8000] flex flex-col items-center justify-center bg-black/75"
        role="status"
        aria-live="polite"
        :aria-label="t('common.loading')">
        <w-spinner size="32px" class="text-white" />
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { isActive } from '@/composables/loading'
import WSpinner from './WSpinner.vue'

/**
 * Full-screen blocking loader. Mounted once, in App.vue; driven by `loading.show()` / `.hide()`.
 *
 * The 500ms delay before this appears lives in `composables/loading.js`, not here -- by the time
 * `isActive` flips, the overlay is meant to be visible immediately.
 */

// I18N

const { t } = useI18n()
</script>

<style scoped>
.w-loading-enter-active,
.w-loading-leave-active {
  transition: opacity 0.2s var(--ease-standard);
}
.w-loading-enter-from,
.w-loading-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .w-loading-enter-active,
  .w-loading-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
