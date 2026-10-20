<template>
  <button
    type="button"
    role="tab"
    :aria-selected="String(isActive)"
    :tabindex="isActive ? 0 : -1"
    :disabled="disable || disabled"
    class="w-tab w-unstyled flex shrink-0 cursor-pointer items-center justify-center rounded-md transition-[background-color,box-shadow,color] duration-200 ease-[var(--ease-standard)]"
    :class="[
      tabs?.dense.value
        ? 'min-h-8 gap-1.5 px-3 py-1 text-[0.8125rem]'
        : 'min-h-10 gap-2 px-4 py-1.5 text-sm',
      tabs?.inlineLabel.value ? 'flex-row' : 'flex-col',
      tabs?.noCaps.value ? 'normal-case' : 'uppercase',
      /*
        Active is a raised pill: a light fill lifted off the track by a shadow, with the label at
        full strength and half a step bolder. Inactive carries its state in the ink alone -- a
        faded-out pill would still read as a pill, which is what makes the active one legible.
      */
      isActive ? 'w-tab--active font-semibold shadow-sm' : 'font-medium',
      tabs?.dark.value
        ? isActive
          ? 'bg-dark-2 text-white'
          : 'text-white/45 hover:text-white/70'
        : isActive
          ? 'bg-white text-black dark:bg-dark-2 dark:text-white'
          : 'text-black/45 hover:text-black/70 dark:text-white/45 dark:hover:text-white/70',
      disable || disabled ? 'pointer-events-none opacity-40' : ''
    ]"
    @click="tabs?.select(name)">
    <!--
      Sized explicitly: WIcon with no `size` inherits the font size, so a tab icon came out at the
      label's 14px. A tab icon is 24px, label beside it or above it, which is the metric the rest of
      the app's icon rows are drawn to -- 18px in a `dense` strip, beside its smaller label.
    -->
    <w-icon v-if="icon" :name="icon" :size="tabs?.dense.value ? `xs` : `sm`" />
    <span v-if="label">{{ label }}</span>
    <slot />
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
