<template>
  <svg
    class="w-circular-progress shrink-0 align-middle"
    :style="sizeStyle"
    viewBox="0 0 100 100"
    role="presentation">
    <circle
      v-if="trackColor"
      cx="50"
      cy="50"
      :r="radius"
      fill="none"
      :stroke="`var(--color-${trackColor})`"
      :stroke-width="strokeWidth" />
    <circle
      class="w-circular-progress__arc"
      cx="50"
      cy="50"
      :r="radius"
      fill="none"
      :stroke="`var(--color-${color})`"
      :stroke-width="strokeWidth"
      stroke-linecap="round"
      :stroke-dasharray="circumference"
      :stroke-dashoffset="circumference * 0.75" />
  </svg>
</template>

<script setup>
import { computed } from 'vue'

/**
 * Indeterminate circular progress ring.
 *
 * Simplification: the component this replaces could also show a determinate value, with a centre
 * fill and a numeric label. Only the indeterminate form is used (a "job is running" marker), so
 * that is all this draws.
 */
const props = defineProps({
  /** A named size, or any CSS length. */
  size: {
    type: String,
    default: '32px'
  },
  /** Ring thickness as a fraction of the radius, matching the value the call site passes. */
  thickness: {
    type: Number,
    default: 0.2
  },
  color: {
    type: String,
    default: 'primary'
  },
  /** Colour of the full ring behind the arc. Omit to leave it unpainted. */
  trackColor: {
    type: String,
    default: null
  }
})

const NAMED_SIZES = {
  xs: '18px',
  sm: '24px',
  md: '32px',
  lg: '38px',
  xl: '46px'
}

const sizeStyle = computed(() => {
  const size = NAMED_SIZES[props.size] ?? props.size
  return { width: size, height: size }
})

// -> Geometry in the 0..100 viewBox: the stroke straddles the radius, so it has to fit inside it
const strokeWidth = computed(() => 50 * props.thickness)
const radius = computed(() => 50 - strokeWidth.value / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
</script>

<style scoped>
.w-circular-progress__arc {
  transform-origin: center;
  animation: w-circular-progress 1.4s linear infinite;
}

@keyframes w-circular-progress {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .w-circular-progress__arc {
    animation-duration: 4s;
  }
}
</style>
