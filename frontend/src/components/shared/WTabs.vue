<template>
  <div
    ref="listEl"
    class="w-tabs flex flex-nowrap items-stretch overflow-x-auto"
    role="tablist"
    @keydown="onKeydown">
    <slot />
  </div>
</template>

<script setup>
import { computed, provide, ref } from 'vue'

/**
 * A strip of tabs. `WTab` children register through it; the panels are either `WTabPanels` or,
 * where a caller prefers, plain `v-if` on the same model.
 *
 * Simplification: no scroll arrows, no overflow menu, no animated indicator travel. The two tab
 * strips in this app have two tabs each; the strip simply scrolls if it ever cannot fit.
 */
const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: null
  },
  /** Leave labels as written instead of upper-casing them. */
  noCaps: {
    type: Boolean,
    default: false
  },
  /** Icon and label side by side rather than stacked. */
  inlineLabel: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue'])

const listEl = ref(null)

provide('wTabs', {
  current: computed(() => props.modelValue),
  noCaps: computed(() => props.noCaps),
  inlineLabel: computed(() => props.inlineLabel),
  select: (name) => emit('update:modelValue', name)
})

/**
 * Arrow keys move between tabs, which is what a tablist is expected to do -- and the reason the
 * handler lives here rather than on each tab: only the strip knows what the neighbours are.
 */
function onKeydown(ev) {
  const keys = { ArrowRight: 1, ArrowLeft: -1, Home: 'first', End: 'last' }
  const move = keys[ev.key]
  if (move === undefined) {
    return
  }
  const tabs = [...listEl.value.querySelectorAll('[role="tab"]:not(:disabled)')]
  if (tabs.length === 0) {
    return
  }
  ev.preventDefault()
  const at = tabs.indexOf(document.activeElement)
  const next =
    move === 'first'
      ? 0
      : move === 'last'
        ? tabs.length - 1
        : (Math.max(at, 0) + move + tabs.length) % tabs.length
  tabs[next].focus()
  tabs[next].click()
}
</script>
