<template>
  <div class="loader-generic">
    <div />
  </div>
</template>

<script setup>
 /**
 * Placeholder for an async component that has not arrived yet.
 *
 * Passed as `loadingComponent` wherever a shell is on screen before its content is: the overlays and
 * side panels, whose backdrop, panel and open transition are already running by the time the chunk is
 * fetched, and the markdown editor, which takes over the page view's article column. Without it those
 * shells stand there empty and then snap to a full screen of content.
 */
</script>

<style lang="scss">
/*
  Fills whatever holds it and centres the box. It did neither: sized and centred by the dialog inner
  of the library this replaces, it was a plain block whose box sat at the top left of the panel, 64px
  of padding under the panel's own top edge.

  Both hosts are covered at once. A dialog panel is a flex column, so `flex: 1` claims the height;
  the editor slot is a plain block of definite height, so `height: 100%` claims it there. Whichever
  applies, the other is inert.
*/
.loader-generic {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;

  > div {
    background-color: rgba(0, 0, 0, 0.75);
    width: 64px;
    height: 64px;
    border-radius: 5px;
    position: relative;

    &:before {
      content: '';
      box-sizing: border-box;
      position: absolute;
      top: 50%;
      left: 50%;
      width: 24px;
      height: 24px;
      margin-top: -12px;
      margin-left: -12px;
      border-radius: 50%;
      border-top: 2px solid #fff;
      border-right: 2px solid transparent;
      animation: loadergenericspinner 0.6s linear infinite;
    }
  }
}

/*
  A panel waiting on its content shows nothing of itself, so what is on screen is the dimmed backdrop
  and this spinner -- not an overlay that has apparently opened empty.

  The surfaces being suppressed are declared per host (a gradient and a hairline for the admin and
  main overlays, nothing at all for a side panel, whose content brings its own card), so there is no
  one rule to sit in front of and `!important` is what makes this independent of them. The
  `box-shadow: none !important` this file used to carry was reaching for the same thing, back when the
  shadow to cancel was on this element rather than on the panel around it.
*/
.w-dialog-panel:has(> .loader-generic) {
  background: none !important;
  box-shadow: none !important;
}

@keyframes loadergenericspinner {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .loader-generic > div:before {
    animation-duration: 2s;
  }
}
</style>
