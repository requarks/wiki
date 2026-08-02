<template>
  <div class="w-layout" :class="container ? 'w-layout--container' : 'w-layout--page'">
    <slot />
  </div>
</template>

<script setup>
/**
 * Application shell: header, optional left/right drawers, page area and footer.
 *
 * Replaces the `view="hHh Lpr lff"` layout engine. Those nine letters encoded which element owned
 * each corner of a 3x3 grid, resolved at runtime into inline offsets on every child. A CSS grid
 * says the same thing declaratively, and every layout in this app used one of only two arrangements
 * (header spanning the top, drawers spanning down through the footer row), so the general engine
 * bought nothing.
 *
 * Children place themselves by grid area, so the markup stays flat -- `WHeader`, `WDrawer`,
 * `WPageContainer` and `WFooter` are siblings, exactly as before. Absent drawers collapse their
 * column to zero width, so nothing has to be conditional in the template.
 *
 * The footer row is for a bar that has to stay put while the page scrolls behind it -- a status bar.
 * The site footer belongs at the bottom of the CONTENT, so it goes inside the `WPageContainer`
 * instead, which stacks it under the page and scrolls the two together; see `WFooter`.
 *
 * `container` scopes the layout to its parent box (height 100%) instead of the viewport, which is
 * what the overlay and dialog layouts need.
 */
defineProps({
  /** Fill the parent element rather than the viewport. */
  container: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
.w-layout {
  display: grid;
  /* -> Drawer columns are sized by their content, so an empty one takes no space at all */
  grid-template-columns: auto 1fr auto;
  grid-template-rows: auto 1fr auto;
  grid-template-areas:
    'header header header'
    'ldrawer main rdrawer'
    'ldrawer footer rdrawer';
  width: 100%;
  /* -> min-height:0 on the row lets the page area scroll instead of stretching the grid */
  min-height: 0;
}

/*
  An app shell: the layout is exactly the viewport, and what scrolls is the page cell inside it.

  `min-height: 100vh` here instead meant the whole document scrolled, which pushed the header, the
  drawers and the footer off the top of the screen and left everything anchored to the bottom of a
  column -- the sidebar's own action bar, the page's action rail -- sitting at the end of the article
  rather than at the bottom of the window. Those things belong to the shell, so the shell has to be
  what stays still.
*/
.w-layout--page {
  height: 100vh;
  overflow: hidden;
}

.w-layout--container {
  height: 100%;
  overflow: hidden;
}

/*
  Either way the layout is bounded -- by the viewport, or by the dialog holding it -- so anything
  taller than that box has to scroll SOMEWHERE. The layout engine this replaces wrapped its whole
  tree in a scrolling div; here the page cell scrolls instead, which keeps the header and the drawers
  in place rather than sliding them away.

  `min-height: 0` is what makes it work at all: a grid item's automatic minimum size is its content,
  so without this the `1fr` row grows to fit and there is nothing left to scroll. Reached with
  `:deep()` because the page cell is a child COMPONENT and this rule has to cross that boundary.

  A page that manages its own scrolling -- the page view scrolls its article column, so that the
  contents sidebar beside it stays put -- simply never overflows this box, and no second scrollbar
  appears.
*/
.w-layout :deep(> .w-page-container) {
  min-height: 0;
  overflow: auto;
}
</style>
