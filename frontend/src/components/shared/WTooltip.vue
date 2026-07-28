<template>
  <!--
    Zero-size, display:none marker left at this component's own position. The tooltip itself is
    teleported to <body>, so without this there would be nothing in the tree identifying which
    element the tooltip describes. `hidden` keeps it out of layout and out of the a11y tree.
  -->
  <span ref="placeholderEl" class="hidden" aria-hidden="true" />
  <teleport to="body">
    <transition name="w-tooltip">
      <div
        v-if="shown"
        ref="floatEl"
        role="tooltip"
        class="w-tooltip pointer-events-none fixed z-[7000] max-w-xs rounded bg-black/85 px-2 py-1 text-xs text-white shadow-menu"
        :style="floatStyle">
        <slot />
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { anchoredPosition } from '@/composables/anchoredPosition'

/**
 * Hover/focus tooltip, written as the last child of whatever it describes:
 *
 *   <w-btn icon="mdi:cog">
 *     <w-tooltip>Settings</w-tooltip>
 *   </w-btn>
 */
const props = defineProps({
  /** Anchor point on the trigger, e.g. `bottom middle`. */
  anchor: {
    type: String,
    default: 'bottom middle'
  },
  /** Matching point on the tooltip itself. */
  self: {
    type: String,
    default: 'top middle'
  },
  /** Extra `[x, y]` displacement in px. */
  offset: {
    type: Array,
    default: () => [0, 8]
  },
  /** Delay before showing, in ms. */
  delay: {
    type: Number,
    default: 250
  }
})

const shown = ref(false)
const floatEl = ref(null)
const placeholderEl = ref(null)
const floatStyle = ref({ left: '0px', top: '0px' })

let triggerEl = null
let timer = null

async function reposition() {
  await nextTick()
  if (!floatEl.value || !triggerEl) {
    return
  }
  const { left, top } = anchoredPosition(
    triggerEl.getBoundingClientRect(),
    { width: floatEl.value.offsetWidth, height: floatEl.value.offsetHeight },
    { anchor: props.anchor, self: props.self, offset: props.offset }
  )
  floatStyle.value = { left: `${left}px`, top: `${top}px` }
}

function show() {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    shown.value = true
    await reposition()
  }, props.delay)
}

function hide() {
  clearTimeout(timer)
  shown.value = false
}

function onKeydown(ev) {
  if (ev.key === 'Escape') {
    hide()
  }
}

onMounted(() => {
  /*
    Climb to the real control rather than stopping at the immediate parent. WBtn wraps its slot in
    an inner <span> (so the label can be hidden while loading), so the naive parent would be that
    span -- and clicking the button's padding, which is outside it, would do nothing.
  */
  const host = placeholderEl.value?.parentElement ?? null
  triggerEl = host?.closest('button, a, .w-btn, .w-item') ?? host
  if (!triggerEl) {
    return
  }

  triggerEl.addEventListener('mouseenter', show)
  triggerEl.addEventListener('mouseleave', hide)
  // -> Keyboard users get the same information, and Escape dismisses it (WAI-ARIA tooltip practice)
  triggerEl.addEventListener('focusin', show)
  triggerEl.addEventListener('focusout', hide)
  triggerEl.addEventListener('keydown', onKeydown)
  // -> Capture phase, so scrolling any ancestor container dismisses rather than leaving it detached
  window.addEventListener('scroll', hide, true)
})

onBeforeUnmount(() => {
  clearTimeout(timer)
  if (triggerEl) {
    triggerEl.removeEventListener('mouseenter', show)
    triggerEl.removeEventListener('mouseleave', hide)
    triggerEl.removeEventListener('focusin', show)
    triggerEl.removeEventListener('focusout', hide)
    triggerEl.removeEventListener('keydown', onKeydown)
  }
  window.removeEventListener('scroll', hide, true)
})
</script>

<style scoped>
.w-tooltip-enter-active,
.w-tooltip-leave-active {
  transition: opacity 0.15s var(--ease-standard);
}
.w-tooltip-enter-from,
.w-tooltip-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .w-tooltip-enter-active,
  .w-tooltip-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
