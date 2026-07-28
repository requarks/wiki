<template>
  <div class="w-tab-panels">
    <slot />
  </div>
</template>

<script setup>
import { computed, provide } from 'vue'

/**
 * Container for the panels belonging to a `WTabs`, sharing its model.
 *
 * Simplification: no slide/fade transition between panels, and no swipe. The panels this replaces
 * were animated by default; nothing in the app relied on it, and a picker dialog switching between
 * a search grid and a text field reads better without the horizontal slide.
 */
const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: null
  }
})

provide('wTabPanels', { current: computed(() => props.modelValue) })
</script>
