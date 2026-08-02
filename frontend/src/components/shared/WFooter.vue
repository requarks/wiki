<template>
  <footer class="w-footer w-full" :class="elevated ? 'shadow-card' : ''">
    <slot />
  </footer>
</template>

<script setup>
/**
 * Bottom bar of a `WLayout`.
 *
 * Where it goes decides what it means, and both placements are used:
 *
 * - As a child of the `WLayout` itself it takes the shell's footer row, beside the drawers rather
 *   than under them, and is PINNED -- the shell is the viewport, so the bar stays put while the page
 *   scrolls behind it. That is what a status bar wants (`FileManager`'s current folder path).
 * - As the last child of a `WPageContainer` it is part of the content that scrolls, so it comes to
 *   rest at the bottom of the page rather than the bottom of the window. That is what the site footer
 *   wants, and it is where every layout puts it.
 *
 * Nothing here has to switch between the two: `grid-area` places it in the shell's grid, and the
 * page container is a flex column -- as is the page view's article scroll area, which holds its
 * footer directly -- where `grid-area` does not apply at all and the bar simply stacks last.
 *
 * `grid-area` is only inert in a parent that is not a grid, though. Dropped into one that has no area
 * by that name it is worse than ignored: the spec has every implicit line answer to an unmatched
 * name, so the bar lands in an implicit COLUMN beside the page rather than under it.
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
  /* -> In a flex column -- the page view puts its footer at the end of the article's scroll area --
        the bar is a fixed-size item, not something to squeeze to make the content fit */
  flex-shrink: 0;
}
</style>
