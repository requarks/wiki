<template>
  <transition :name="anchorX ? `w-page-scroller-slide` : `w-page-scroller-fade`">
    <div
      v-if="visible"
      class="w-page-scroller fixed bottom-0 z-40"
      :class="anchorX ? `w-page-scroller--anchored` : `right-0`"
      :style="anchorX ? { left: anchorX } : null"
      @click="scrollToTop">
      <slot />
    </div>
  </transition>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * "Back to top" affordance that appears once the page has been scrolled past `scrollOffset`, and
 * smooth-scrolls to the top when clicked.
 *
 * Always flush against the bottom of the viewport, in one of two places: the bottom-right corner, or
 * with its right edge at `anchorX` — which is how it tucks into the bottom of the nav sidebar's
 * column. Scrolling uses the platform's own smooth behaviour rather than the hand-rolled easing the
 * previous component shipped, and honours `prefers-reduced-motion` for free.
 */
const props = defineProps({
  /** Show once the window has scrolled this many pixels. */
  scrollOffset: {
    type: Number,
    default: 1000
  },
  /**
   * Any CSS length, which becomes the x of the button's RIGHT EDGE measured from the left of the
   * viewport — so it ends where a column beside it does. Null keeps it in the corner.
   */
  anchorX: {
    type: String,
    default: null
  },
  /**
   * Selector for the element that scrolls, when it is not the window.
   *
   * The shell is the viewport, so a page view scrolls its own article column rather than the
   * document; this button lives in the shell, outside that column, and so cannot find it by looking
   * upwards. Resolved on each use rather than held, because the element belongs to the routed page
   * and is replaced whenever that changes. Falls back to the window when there is no match.
   */
  target: {
    type: String,
    default: null
  }
})

const visible = ref(false)

/** The scrolling element, or null when it is the window. */
function scroller() {
  return props.target ? document.querySelector(props.target) : null
}

function onScroll() {
  const el = scroller()
  visible.value = (el ? el.scrollTop : window.scrollY) > props.scrollOffset
}

function scrollToTop() {
  // -> `smooth` is ignored when the user has asked for reduced motion, which is the behaviour we want
  ;(scroller() ?? window).scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  // -> `capture`, because a scroll event on an element does not bubble to the window
  window.addEventListener('scroll', onScroll, { capture: true, passive: true })
  onScroll()
})

onBeforeUnmount(() => window.removeEventListener('scroll', onScroll, { capture: true }))
</script>

<style scoped>
/*
  `anchorX` is where the button ENDS, so it is shifted left by its own width -- which is the one
  measurement only the button itself knows, and the reason this is a transform rather than arithmetic
  on the anchor. Restated in the slide below, since a transform is one property and the two movements
  share it.
*/
.w-page-scroller--anchored {
  transform: translateX(-100%);
}

/*
  Anchored, it comes and goes by the edge it sits on: out of the bottom of the viewport and back down
  into it, which is a movement the corner it is tucked into can explain. The button is flush against
  that edge, so there is nothing for it to slide behind and no gap to cross.
*/
.w-page-scroller-slide-enter-active,
.w-page-scroller-slide-leave-active {
  transition: transform 0.2s var(--ease-standard);
}
.w-page-scroller-slide-enter-from,
.w-page-scroller-slide-leave-to {
  transform: translateX(-100%) translateY(100%);
}

/* In the corner it still fades, which is how every other corner button gives way -- see `.corner-btn` */
.w-page-scroller-fade-enter-active,
.w-page-scroller-fade-leave-active {
  transition: opacity 0.2s var(--ease-standard);
}
.w-page-scroller-fade-enter-from,
.w-page-scroller-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .w-page-scroller-slide-enter-active,
  .w-page-scroller-slide-leave-active,
  .w-page-scroller-fade-enter-active,
  .w-page-scroller-fade-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
