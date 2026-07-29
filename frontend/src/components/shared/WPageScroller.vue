<template>
  <transition name="w-page-scroller">
    <div
      v-if="visible"
      class="w-page-scroller fixed z-40"
      :style="anchorStyle"
      @click="scrollToTop">
      <slot />
    </div>
  </transition>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Floating "back to top" affordance that appears once the page has been scrolled past
 * `scrollOffset`, and smooth-scrolls to the top when clicked.
 *
 * Sits in the bottom-right corner unless `anchorX` puts it somewhere else horizontally. Scrolling
 * uses the platform's own smooth behaviour rather than the hand-rolled easing the previous component
 * shipped, and honours `prefers-reduced-motion` for free.
 */
const props = defineProps({
  /** Show once the window has scrolled this many pixels. */
  scrollOffset: {
    type: Number,
    default: 1000
  },
  /** `[x, y]` distance from the viewport corner, in px. `x` is unused when `anchorX` is set. */
  offset: {
    type: Array,
    default: () => [18, 18]
  },
  /**
   * Any CSS length, which becomes the x of the button's CENTRE measured from the left of the
   * viewport — so it can straddle an edge rather than clear it. Null keeps it in the corner.
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

const anchorStyle = computed(() => {
  const bottom = `${props.offset[1]}px`
  // -> `translateX(-50%)` is what makes `anchorX` a centre rather than a left edge
  return props.anchorX
    ? { bottom, left: props.anchorX, transform: 'translateX(-50%)' }
    : { bottom, right: `${props.offset[0]}px` }
})

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
.w-page-scroller-enter-active,
.w-page-scroller-leave-active {
  transition: opacity 0.2s var(--ease-standard);
}
.w-page-scroller-enter-from,
.w-page-scroller-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .w-page-scroller-enter-active,
  .w-page-scroller-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
