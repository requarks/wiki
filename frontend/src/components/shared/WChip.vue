<template>
  <div
    class="w-chip inline-flex max-w-full flex-nowrap items-center gap-1.5 align-middle"
    :class="classes"
    :style="styles"
    :tabindex="clickable ? 0 : undefined"
    :role="clickable ? 'button' : undefined"
    @click="clickable && $emit('click', $event)"
    @keydown.enter.prevent="clickable && $emit('click', $event)">
    <w-icon v-if="icon" :name="icon" class="shrink-0" />
    <span class="truncate">
      <slot>{{ label }}</slot>
    </span>
    <button
      v-if="removable"
      type="button"
      class="w-unstyled shrink-0 cursor-pointer rounded-full opacity-70 hover:opacity-100"
      :aria-label="removeLabel"
      @click.stop="$emit('remove')">
      <w-icon name="mdi:close" />
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

/**
 * Compact label for a tag, status or selected value.
 */
const props = defineProps({
  label: {
    type: [String, Number],
    default: null
  },
  icon: {
    type: String,
    default: null
  },
  color: {
    type: String,
    default: null
  },
  textColor: {
    type: String,
    default: null
  },
  /** `xs` | `sm` | `md` | `lg`, or a CSS font-size. */
  size: {
    type: String,
    default: 'md'
  },
  /** Sharp corners instead of a pill. */
  square: {
    type: Boolean,
    default: false
  },
  dense: {
    type: Boolean,
    default: false
  },
  clickable: {
    type: Boolean,
    default: false
  },
  removable: {
    type: Boolean,
    default: false
  },
  /** Accessible name for the remove button. */
  removeLabel: {
    type: String,
    default: 'Remove'
  }
})

defineEmits(['click', 'remove'])

const SIZES = { xs: '10px', sm: '12px', md: '14px', lg: '16px' }

const classes = computed(() => [
  props.square ? 'rounded-sm' : 'rounded-full',
  props.dense ? 'px-2 py-0.5' : 'px-3 py-1',
  props.clickable ? 'cursor-pointer hover:brightness-110' : '',
  // -> Uncoloured chips fall back to a neutral surface tint rather than being invisible
  props.color ? '' : 'bg-black/8 dark:bg-white/12'
])

const styles = computed(() => ({
  fontSize: SIZES[props.size] ?? props.size,
  backgroundColor: props.color ? `var(--color-${props.color})` : undefined,
  color: props.textColor ? `var(--color-${props.textColor})` : undefined
}))
</script>
