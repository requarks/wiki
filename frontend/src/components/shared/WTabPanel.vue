<template>
  <div v-show="isActive" class="w-tab-panel" role="tabpanel">
    <slot />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'

/** One panel within a `WTabPanels`, shown when its `name` is the current tab. */
const props = defineProps({
  name: {
    type: [String, Number],
    required: true
  }
})

const panels = inject('wTabPanels', null)
const isActive = computed(() => panels?.current.value === props.name)
</script>
