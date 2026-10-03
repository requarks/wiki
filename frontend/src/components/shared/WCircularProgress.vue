<template>
  <svg
    class="w-circular-progress shrink-0 align-middle"
    :class="{ 'w-circular-progress--determinate': isDeterminate }"
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
      :stroke-linecap="isDeterminate && value <= 0 ? 'butt' : 'round'"
      :stroke-dasharray="circumference"
      :stroke-dashoffset="dashOffset" />
  </svg>
</template>

<script setup>
import { computed } from 'vue'

/**
 * Circular progress ring: a spinning arc, or, given a `value`, a ring filled that far clockwise from
 * the top.
 *
 * Simplification: the component this replaces could also draw a centre fill and a numeric label
 * inside the ring. Nothing uses either — a caller that shows the figure writes it beside the ring.
 */
const props = defineProps({
  /** Percentage filled, 0 to 100. Omit for the indeterminate spinner. */
  value: {
    type: Number,
    default: null
  },
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

const isDeterminate = computed(() => props.value !== null)

/*
  A zero-length dash still paints its round caps as a dot, which would read as "a little done", so a
  ring at 0 switches to butt caps above and draws nothing.
*/
const dashOffset = computed(() => {
  if (!isDeterminate.value) {
    return circumference.value * 0.75
  }
  const fraction = Math.min(Math.max(props.value, 0), 100) / 100
  return circumference.value * (1 - fraction)
})
</script>

<style scoped>
.w-circular-progress__arc {
  transform-origin: center;
  animation: w-circular-progress 1.4s linear infinite;
}

/* -> SVG strokes start at three o'clock; a progress ring reads from twelve */
.w-circular-progress--determinate .w-circular-progress__arc {
  animation: none;
  transform: rotate(-90deg);
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
/* -> Twinned under the Reduce Motion profile setting; see `css/_animation.scss` */
.body--reduce-motion .w-circular-progress__arc {
  animation-duration: 4s;
}
</style>
