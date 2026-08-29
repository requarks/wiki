<template>
  <teleport to="body">
    <transition name="w-loading">
      <div
        v-if="isActive"
        class="w-loading fixed inset-0 z-[8000] flex flex-col items-center justify-center bg-black/75"
        role="status"
        aria-live="polite"
        :aria-label="content.message || t('common.loading')">
        <w-spinner size="32px" class="text-white" />
        <p v-if="content.message" class="w-loading-message">{{ content.message }}</p>
        <p v-if="content.caption" class="w-loading-caption">{{ content.caption }}</p>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { content, isActive } from '@/composables/loading'
import WSpinner from './WSpinner.vue'

/**
 * Full-screen blocking loader. Mounted once, in App.vue; driven by `loading.show()` / `.hide()`.
 *
 * The 500ms delay before this appears lives in `composables/loading.js`, not here -- by the time
 * `isActive` flips, the overlay is meant to be visible immediately.
 *
 * `aria-label` is the message where there is one: the generic "Loading..." would otherwise be
 * announced INSTEAD of the contents, a label on a live region standing in for what it labels.
 */

// I18N

const { t } = useI18n()
</script>

<style scoped>
/*
  Held off the spinner and each other, and kept to a readable measure -- the overlay is the full
  viewport, so an unconstrained line would run its whole width.
*/
.w-loading-message {
  margin: 1.25rem 0 0;
  max-width: 28rem;
  padding: 0 1.5rem;
  text-align: center;
  font-size: 1rem;
  font-weight: 500;
  color: #fff;
}

.w-loading-caption {
  margin: 0.5rem 0 0;
  max-width: 28rem;
  padding: 0 1.5rem;
  text-align: center;
  font-size: 0.875rem;
  color: rgb(255 255 255 / 0.7);
}

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
