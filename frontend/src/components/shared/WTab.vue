<template>
  <button
    type="button"
    role="tab"
    :aria-selected="String(isActive)"
    :tabindex="isActive ? 0 : -1"
    :disabled="disable || disabled"
    class="w-tab w-unstyled relative flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors"
    :class="[
      tabs?.inlineLabel.value ? 'flex-row' : 'flex-col',
      tabs?.noCaps.value ? 'normal-case' : 'uppercase',
      isActive ? 'w-tab--active' : 'opacity-70 hover:opacity-100',
      disable || disabled ? 'pointer-events-none opacity-40' : ''
    ]"
    @click="tabs?.select(name)">
    <w-icon v-if="icon" :name="icon" />
    <span v-if="label">{{ label }}</span>
    <slot />
    <!-- The active marker, drawn under the tab rather than as a strip that slides between them -->
    <span
      v-if="isActive"
      class="absolute inset-x-0 bottom-0 h-0.5 rounded-t bg-current"
      aria-hidden="true" />
  </button>
</template>

<script setup>
import { computed, inject } from 'vue'
import WIcon from './WIcon.vue'

/** One tab within a `WTabs`. Identified by `name`, which is what the strip's model holds. */
const props = defineProps({
  name: {
    type: [String, Number],
    required: true
  },
  label: {
    type: String,
    default: null
  },
  icon: {
    type: String,
    default: null
  },
  disable: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  }
})

const tabs = inject('wTabs', null)
const isActive = computed(() => tabs?.current.value === props.name)
</script>

<style scoped>
/*
  `uppercase` is set in CSS for the same reason as in WBtn: Quasar's normalize declares
  `button { text-transform: none }` unlayered, which beats any layered utility -- so the class
  alone would silently do nothing on a <button>.
*/
.w-tab {
  text-transform: uppercase;
}
.w-tab.normal-case {
  text-transform: none;
}
</style>
