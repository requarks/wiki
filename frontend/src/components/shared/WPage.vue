<template>
  <main class="w-page" :class="padding ? 'p-4' : ''">
    <slot />
  </main>
</template>

<script setup>
/**
 * Route-level content container.
 *
 * The layout system this replaces computed a min-height from the header and footer heights via
 * JavaScript. That is unnecessary here -- `WLayout`'s grid already gives the page cell the leftover
 * height -- but the page still has to CLAIM it: as a plain block it is only as tall as its content,
 * so anything inside sized `flex: 1` or `height: 100%` has nothing to grow into. That is what left
 * the page sidebars ending partway down the window.
 */
defineProps({
  padding: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
/*
  Fill the content cell. `min-height` rather than `height` so a page taller than the viewport still
  grows, and on the page cell rather than the container so that a container holding something other
  than a page (the search screen's floating card) is left alone.
*/
.w-page {
  min-height: 100%;
}
</style>
