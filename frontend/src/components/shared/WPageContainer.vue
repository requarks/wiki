<template>
  <div class="w-page-container min-w-0">
    <slot />
  </div>
</template>

<script setup>
 /**
 * The main content cell of a `WLayout`, and the box that scrolls.
 *
 * `min-width: 0` is load-bearing: without it a wide child (a table, a code block) would blow the
 * grid column out rather than scrolling inside it.
 *
 * A column, so that a `WFooter` written as the last child comes to rest at the bottom of the CONTENT
 * rather than the bottom of the window: the page above it takes the leftover height, the footer sits
 * under it, and both scroll together inside this box.
 *
 * The classic sticky-footer arrangement, and the parts of it matter:
 *
 * - `flex-basis: auto` starts from the page's OWN height, so a page taller than this box grows past
 *   it and scrolls, taking the footer with it. This is what a grid with a `1fr` content row could not
 *   do: a grid item is stretched to its track, which fixes its height at the leftover space, and
 *   anything longer then spilled out of the bottom of the page instead of extending it.
 * - `flex-grow: 1` fills the leftover height when the page is shorter, so the footer still lands at
 *   the bottom of the window rather than hanging under two lines of content.
 * - `flex-shrink: 0` keeps a long page from being squeezed to make room for the footer.
 * - `min-height: 0` overrides `WPage`'s own `min-height: 100%`, which measures the WHOLE box: the
 *   page would claim the footer's height as well and every short page would scroll a little. Nested
 *   pages -- the one inside the profile card, say -- still use it, so it stays there.
 *
 * Specificity: `:not()` counts its argument, so `> :not(.w-footer)` outweighs `WPage`'s own rule
 * rather than depending on which stylesheet Vite happens to inject first.
 */
</script>

<style scoped>
.w-page-container {
  grid-area: main;
  display: flex;
  flex-direction: column;
}

.w-page-container :deep(> :not(.w-footer)) {
  flex: 1 0 auto;
  min-height: 0;
}
</style>
