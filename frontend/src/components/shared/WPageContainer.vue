<template>
  <div class="w-page-container min-w-0">
    <slot />
  </div>
</template>

<script setup>
 /**
 * The main content cell of a `WLayout`.
 *
 * `min-width: 0` is load-bearing: without it a wide child (a table, a code block) would blow the
 * grid column out rather than scrolling inside it.
 */
</script>

<style scoped>
.w-page-container {
  grid-area: main;
}
</style>
