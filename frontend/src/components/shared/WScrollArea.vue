<template>
  <div class="w-scroll-area overflow-auto">
    <slot />
  </div>
</template>

<script setup>
 /**
 * Scrollable region with a slim, styled scrollbar.
 *
 * Simplification: the component this replaces rendered a virtual scrollbar out of real DOM nodes,
 * configured through `thumb-style` / `bar-style` objects, and exposed imperative scroll methods.
 * Nothing here used the scroll API, and the styling those props carried was the same slim grey
 * thumb everywhere -- so this is a native scroll container with `scrollbar-width: thin`, which
 * behaves better (keyboard, momentum, accessibility) than a synthetic one.
 *
 * Callers set the height themselves, exactly as before.
 */
</script>

<style scoped>
.w-scroll-area {
  scrollbar-width: thin;
  scrollbar-color: rgb(102 102 102 / 0.5) transparent;
}

/* -> WebKit ignores scrollbar-color, so the same treatment is repeated for it */
.w-scroll-area::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}
.w-scroll-area::-webkit-scrollbar-track {
  background: transparent;
}
.w-scroll-area::-webkit-scrollbar-thumb {
  background-color: rgb(102 102 102 / 0.5);
  border-radius: 5px;
}
.w-scroll-area::-webkit-scrollbar-thumb:hover {
  background-color: rgb(102 102 102 / 0.8);
}
</style>
