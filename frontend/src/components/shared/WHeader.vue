<template>
  <header
    class="w-header z-20 w-full"
    :class="[elevated ? 'shadow-card' : '', reveal ? 'sticky top-0' : '']">
    <slot />
  </header>
</template>

<script setup>
/**
 * Top bar of a `WLayout`. Spans the full width, above both drawers.
 *
 * Carries no colour of its own: every header in the app sets its own surface with a utility class.
 */
defineProps({
  /** Drop shadow beneath the header. */
  elevated: {
    type: Boolean,
    default: false
  },
  /** Keep the header pinned while the page scrolls. */
  reveal: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
.w-header {
  grid-area: header;
}
</style>
