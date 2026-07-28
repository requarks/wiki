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
 * Simplification: only the bottom-right placement is offered, which is the only one the app used.
 * Scrolling uses the platform's own smooth behaviour rather than the hand-rolled easing the
 * previous component shipped, and honours `prefers-reduced-motion` for free.
 */
const props = defineProps({
  /** Show once the window has scrolled this many pixels. */
  scrollOffset: {
    type: Number,
    default: 1000
  },
  /** `[x, y]` distance from the viewport corner, in px. */
  offset: {
    type: Array,
    default: () => [18, 18]
  }
})

const visible = ref(false)

const anchorStyle = computed(() => ({
  right: `${props.offset[0]}px`,
  bottom: `${props.offset[1]}px`
}))

function onScroll() {
  visible.value = window.scrollY > props.scrollOffset
}

function scrollToTop() {
  // -> `smooth` is ignored when the user has asked for reduced motion, which is the behaviour we want
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})

onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
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
