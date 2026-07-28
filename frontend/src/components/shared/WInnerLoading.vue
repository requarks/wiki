<template>
  <transition name="w-inner-loading">
    <div
      v-if="showing"
      class="w-inner-loading absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/70 dark:bg-dark-5/70"
      role="status"
      aria-live="polite">
      <w-spinner :size="size" :class="spinnerClass" />
      <slot />
    </div>
  </transition>
</template>

<script setup>
import WSpinner from './WSpinner.vue'

/**
 * Loading veil covering its nearest positioned ancestor. The parent needs `relative`.
 */
defineProps({
  showing: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: '42px'
  },
  /** Text-colour utility for the spinner, e.g. `text-primary`. */
  spinnerClass: {
    type: String,
    default: 'text-primary'
  }
})
</script>

<style scoped>
.w-inner-loading-enter-active,
.w-inner-loading-leave-active {
  transition: opacity 0.2s var(--ease-standard);
}
.w-inner-loading-enter-from,
.w-inner-loading-leave-to {
  opacity: 0;
}
</style>
