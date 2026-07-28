<template>
  <div
    class="w-rating inline-flex align-middle"
    role="radiogroup"
    :style="rootStyle"
    :aria-readonly="readonly ? 'true' : undefined"
    :aria-disabled="disable ? 'true' : undefined"
    @mouseleave="hovered = 0">
    <div
      v-for="i of max"
      :key="i"
      :ref="(el) => setContainer(el, i)"
      class="w-rating__icon-container flex h-[1em] items-center justify-center outline-0"
      :class="[editable ? 'cursor-pointer' : '', i > 1 ? 'ml-0.5' : '']"
      role="radio"
      :tabindex="editable ? 0 : -1"
      :aria-checked="modelValue === i ? 'true' : 'false'"
      :aria-label="`${i}`"
      @click="set(i)"
      @mouseover="editable && (hovered = i)"
      @keyup="onKeyup($event, i)">
      <w-icon :name="icon" class="w-rating__icon" :class="iconClass(i)" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import WIcon from './WIcon.vue'

/**
 * Star rating.
 *
 * Simplification: the component this replaces accepted per-star arrays for the icon and colour, a
 * separate half-star icon, and a `no-reset` switch. The one caller passes a single icon and a
 * single colour, so this takes scalars; half ratings are not offered because nothing produced
 * them.
 *
 * Behaviour is otherwise preserved, including the two details that are easy to lose: clicking the
 * star you are already on resets the rating to zero, and the arrow keys move FOCUS between stars
 * rather than changing the value -- it is Enter or Space that commits.
 */
const props = defineProps({
  /** Current rating, 0 for unrated. */
  modelValue: {
    type: Number,
    default: 0
  },
  /** How many stars to draw. */
  max: {
    type: Number,
    default: 5
  },
  /** Icon reference for a star. */
  icon: {
    type: String,
    default: 'mdi:star'
  },
  /** Theme colour name. Defaults to the same yellow the original used. */
  color: {
    type: String,
    default: null
  },
  /** A named size, or any CSS length. Sets the icon font size. */
  size: {
    type: String,
    default: null
  },
  readonly: Boolean,
  disable: Boolean
})

const emit = defineEmits(['update:modelValue'])

/** The named sizes the icon components use, so `size="sm"` means the same thing everywhere. */
const NAMED_SIZES = {
  xs: '18px',
  sm: '24px',
  md: '32px',
  lg: '38px',
  xl: '46px'
}

/** Which star the pointer is over, or 0. Drives the preview highlight. */
const hovered = ref(0)

/*
  Indexed by hand rather than collected through a shared `ref` name: Vue makes no promise that a
  `v-for` ref array comes back in source order, and moving focus one star along depends on it.
*/
const containers = ref([])
function setContainer(el, i) {
  containers.value[i - 1] = el
}

const editable = computed(() => !props.readonly && !props.disable)

const rootStyle = computed(() => ({
  color: `var(--color-${props.color ?? 'yellow'})`,
  fontSize: props.size ? (NAMED_SIZES[props.size] ?? props.size) : undefined
}))

/**
 * Three states, matching the original's opacities: a star is lit when it is within the rating (or
 * within the hover preview), half-lit when the hover preview is currently BELOW the committed
 * rating -- so you can see what you are about to give up -- and dim otherwise.
 */
function iconClass(i) {
  const active = hovered.value === 0 ? props.modelValue >= i : hovered.value >= i
  const exSelected = hovered.value > 0 && props.modelValue >= i && hovered.value < i
  return [
    active ? 'opacity-100' : exSelected ? 'opacity-70' : 'opacity-40',
    hovered.value === i ? 'scale-[1.3]' : ''
  ]
}

function set(value) {
  if (!editable.value) {
    return
  }
  // -> Clicking the current rating clears it, which is the only way to get back to unrated
  const next = props.modelValue === value ? 0 : value
  if (next !== props.modelValue) {
    emit('update:modelValue', next)
  }
  hovered.value = 0
}

function onKeyup(e, i) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    e.stopPropagation()
    set(i)
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
    e.preventDefault()
    e.stopPropagation()
    containers.value?.[i - 2]?.focus()
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
    e.preventDefault()
    e.stopPropagation()
    containers.value?.[i]?.focus()
  }
}
</script>

<style scoped>
.w-rating__icon {
  position: relative;
  color: currentColor;
  text-shadow:
    0 1px 3px rgb(0 0 0 / 0.12),
    0 1px 2px rgb(0 0 0 / 0.24);
  transition:
    transform 0.2s ease-in,
    opacity 0.2s ease-in,
    color 0.2s ease-in;
}

@media (prefers-reduced-motion: reduce) {
  .w-rating__icon {
    transition-duration: 0.01ms;
  }
}
</style>
