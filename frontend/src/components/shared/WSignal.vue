<template>
  <span class="w-signal" :style="style" role="presentation">
    <span class="w-signal__ring" />
    <span class="w-signal__ring" />
    <span class="w-signal__core" />
  </span>
</template>

<script setup>
import { computed } from 'vue'

/**
 * Status signal -- concentric rings pulsing outward from a beating core.
 *
 * Distinct from `WSpinner` on purpose. A spinner says "working, please wait" and is expected to
 * stop; this says "live", and runs for as long as the thing it describes is in that state. The
 * admin metrics and API screens use it as an at-a-glance indicator beside an enabled/disabled
 * label, where a rotating spinner would read as a page that never finished loading.
 *
 * Geometry mirrors the `q-spinner-rings` it replaces, so the two look identical at the same size:
 * a 45-unit box, a 2-unit stroke, rings growing from radius 6 to 22 over 3s while their stroke
 * thins to nothing, half a cycle apart.
 */
const props = defineProps({
  /** A named size, or any CSS length. */
  size: {
    type: String,
    default: '24px'
  },
  /** Theme color name. Omit to inherit the surrounding text color. */
  color: {
    type: String,
    default: null
  }
})

/** The named sizes the icon components use, so `size="md"` means the same thing everywhere. */
const NAMED_SIZES = {
  xs: '18px',
  sm: '24px',
  md: '32px',
  lg: '38px',
  xl: '46px'
}

const style = computed(() => ({
  '--w-signal-size': NAMED_SIZES[props.size] ?? props.size,
  color: props.color ? `var(--color-${props.color})` : undefined
}))
</script>

<style scoped>
.w-signal {
  /*
    `display` is set here rather than with an `inline-block` utility for the same reason as in
    `WSpinner`: Quasar declares `.inline-block { display: inline-block !important }` unlayered, and
    an !important stylesheet rule beats a non-important inline style -- which would defeat
    `v-show`. A scoped rule carries no !important, so `v-show` wins as it should.
  */
  display: inline-block;
  position: relative;
  flex-shrink: 0;
  width: var(--w-signal-size);
  height: var(--w-signal-size);
  vertical-align: middle;

  /* One unit of the original 45-unit viewBox, so the stroke scales with the component */
  --w-signal-unit: calc(var(--w-signal-size) / 45);
}

/*
  Every circle is centred and sized from the middle out. `border-box` is what keeps the
  correspondence with the SVG exact: an SVG circle's painted diameter is `2r + stroke`, which is
  precisely the border-box width of a bordered element.
*/
.w-signal__ring,
.w-signal__core {
  position: absolute;
  top: 50%;
  left: 50%;
  box-sizing: border-box;
  border: 0 solid currentColor;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

/*
  Resting state, and what `prefers-reduced-motion` falls back to: the rings invisible and the core
  at full size, leaving a plain ring that still reads as a status light.
*/
.w-signal__ring {
  opacity: 0;
}

.w-signal__core {
  /* 2 * 6 + 2 units across */
  width: calc(var(--w-signal-unit) * 14);
  height: calc(var(--w-signal-unit) * 14);
  border-width: calc(var(--w-signal-unit) * 2);
}

.w-signal__ring {
  animation: w-signal-ring 3s linear infinite;
}

/* Half a cycle apart, so a new ring leaves as the previous one is midway out */
.w-signal__ring:nth-child(1) {
  animation-delay: 1.5s;
}
.w-signal__ring:nth-child(2) {
  animation-delay: 3s;
}

.w-signal__core {
  animation: w-signal-core 1.5s linear infinite;
}

/* Radius 6 -> 22 as the stroke thins 2 -> 0, so the ring dissolves as it reaches the edge */
@keyframes w-signal-ring {
  from {
    width: calc(var(--w-signal-unit) * 14);
    height: calc(var(--w-signal-unit) * 14);
    border-width: calc(var(--w-signal-unit) * 2);
    opacity: 1;
  }
  to {
    width: calc(var(--w-signal-unit) * 44);
    height: calc(var(--w-signal-unit) * 44);
    border-width: 0;
    opacity: 0;
  }
}

/*
  The core collapses in one step and climbs back out in five -- a heartbeat rather than a
  symmetrical throb. Radius 6, 1, 2, 3, 4, 5, 6 at a constant 2-unit stroke.
*/
@keyframes w-signal-core {
  0% {
    width: calc(var(--w-signal-unit) * 14);
    height: calc(var(--w-signal-unit) * 14);
  }
  16.667% {
    width: calc(var(--w-signal-unit) * 4);
    height: calc(var(--w-signal-unit) * 4);
  }
  33.333% {
    width: calc(var(--w-signal-unit) * 6);
    height: calc(var(--w-signal-unit) * 6);
  }
  50% {
    width: calc(var(--w-signal-unit) * 8);
    height: calc(var(--w-signal-unit) * 8);
  }
  66.667% {
    width: calc(var(--w-signal-unit) * 10);
    height: calc(var(--w-signal-unit) * 10);
  }
  83.333% {
    width: calc(var(--w-signal-unit) * 12);
    height: calc(var(--w-signal-unit) * 12);
  }
  100% {
    width: calc(var(--w-signal-unit) * 14);
    height: calc(var(--w-signal-unit) * 14);
  }
}

@media (prefers-reduced-motion: reduce) {
  .w-signal__ring,
  .w-signal__core {
    animation: none;
  }
}
</style>
