<template>
  <footer class="w-footer w-full" :class="elevated ? 'shadow-card' : ''">
    <slot />
  </footer>
</template>

<script setup>
/**
 * Bottom bar of a `WLayout`. Sits beside the drawers rather than under them, matching the `lff`
 * footer row every layout in this app declared.
 */
defineProps({
  elevated: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
.w-footer {
  grid-area: footer;
}
</style>
