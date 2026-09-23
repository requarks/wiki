<template>
  <div
    class="w-linear-progress relative w-full overflow-hidden"
    :class="rounded ? 'rounded-full' : ''"
    :style="{ height: resolvedSize, '--w-linear-progress-color': trackColor }"
    role="progressbar"
    :aria-valuenow="indeterminate ? undefined : Math.round(value * 100)"
    :aria-valuemin="indeterminate ? undefined : 0"
    :aria-valuemax="indeterminate ? undefined : 100">
    <div
      class="absolute inset-0"
      :class="striped ? 'w-linear-progress-striped' : 'opacity-25'"
      :style="striped ? undefined : { backgroundColor: trackColor }" />
    <div
      class="w-linear-progress-bar absolute inset-y-0 left-0"
      :class="indeterminate ? 'w-linear-progress-indeterminate' : ''"
      :style="barStyle" />
  </div>
</template>

<script setup>
import { computed } from 'vue'

/**
 * Horizontal progress bar, determinate or indeterminate.
 */
const props = defineProps({
  /** Progress from 0 to 1. Ignored when `indeterminate` or `query` is set. */
  value: {
    type: Number,
    default: 0
  },
  /** Continuous animation for work of unknown duration. */
  indeterminate: {
    type: Boolean,
    default: false
  },
  /** Alias of `indeterminate`, matching the previous component's naming. */
  query: {
    type: Boolean,
    default: false
  },
  color: {
    type: String,
    default: 'primary'
  },
  /** A named size (`xs`..`xl`) or any CSS length. */
  size: {
    type: String,
    default: '4px'
  },
  /** Fully rounded ends. */
  rounded: {
    type: Boolean,
    default: false
  },
  /**
   * Draw the track as diagonal stripes travelling right to left, rather than as a flat tint. For
   * work that is running: the bar says how far along it is, the stripes say it is still moving.
   */
  striped: {
    type: Boolean,
    default: false
  }
})

const NAMED_SIZES = { xs: '2px', sm: '4px', md: '6px', lg: '10px', xl: '14px' }

const resolvedSize = computed(() => NAMED_SIZES[props.size] ?? props.size)

/*
  An unrecognised colour name falls back to primary rather than resolving to nothing. The previous
  component silently rendered an uncoloured bar for a name with no matching class -- which is how
  `color="page"` (a name that has never existed) ended up effectively invisible.
*/
const trackColor = computed(() => `var(--color-${props.color}, var(--color-primary))`)

const isIndeterminate = computed(() => props.indeterminate || props.query)

const barStyle = computed(() => ({
  backgroundColor: trackColor.value,
  width: isIndeterminate.value ? undefined : `${Math.min(100, Math.max(0, props.value * 100))}%`,
  transition: isIndeterminate.value ? undefined : 'width 0.3s var(--ease-standard)'
}))
</script>

<style scoped>
/*
  The fill: a band of the colour and a lighter tone of it, tiled across the bar, plus a glow.

  The tile has the SAME colour at both ends (`c -> lighter -> c`), which is what makes it repeat
  seamlessly -- a two-stop ramp would show a hard step at every tile boundary. It is sized in px
  rather than as a percentage of the bar, because a percentage is a percentage of the FILL: the band
  would stretch as the bar grew, and the drift below would change speed with the progress.

  The glow is in the bar's own colour, so it reads as the bar being lit rather than as a drop shadow
  under it. The track clips it (`overflow: hidden`, which the indeterminate bar and the rounded ends
  both need), so what survives is the spill ahead of the leading edge -- which is the half worth
  having: a soft edge where the bar meets the track and nothing anywhere else. Two shadows rather
  than one, a tight near-opaque core that carries over a striped track and a wider soft halo around
  it; turning a single blur up far enough to show against the stripes makes a hard collar at the
  bar's edge instead of a fade.

  Both paint over the track because the bar is the later of the two children -- a box-shadow is drawn
  behind its OWN element but above everything under it in the stacking order.
*/
.w-linear-progress-bar {
  background-image: linear-gradient(
    to right,
    var(--w-linear-progress-color),
    color-mix(in srgb, var(--w-linear-progress-color) 64%, white),
    var(--w-linear-progress-color)
  );
  background-size: 72px 100%;
  box-shadow:
    0 0 5px 1px color-mix(in srgb, var(--w-linear-progress-color) 90%, transparent),
    0 0 14px 4px color-mix(in srgb, var(--w-linear-progress-color) 55%, transparent);
}

/*
  The band drifts left to right, one whole period per cycle so the loop has no seam, which is what
  makes a determinate bar read as running even while its width holds still.

  Not on the indeterminate bar: that one already moves, and its own keyframes are the same `animation`
  shorthand -- declaring both here would leave which survives to the order of the two rules.
*/
.w-linear-progress-bar:not(.w-linear-progress-indeterminate) {
  animation: w-linear-progress-sheen 1.8s linear infinite;
}

/*
  A square tile crossed by one 45deg band, repeated -- the arrangement that tiles seamlessly in both
  axes, which a `repeating-linear-gradient` at an angle does not without matching its period to the
  tile by hand. Both tones are the bar's own colour, so a striped track reads as the unfilled part of
  the same bar on any surface rather than as a grey the background may or may not suit.

  It animates towards x = 0, which moves the pattern leftward -- against the direction the solid bar
  grows, so the two do not read as one drifting shape.

  The two tones are far enough apart to read at a glance rather than as a texture: the light stripe
  is most of the colour and the dark one is nearly nothing, so the track is legible on a light and a
  dark surface alike, where a pair of close mid tones is only ever legible on one of them.

  Both are mixed off a DARKENED copy of the bar's colour, which is what keeps the track sitting
  behind the fill rather than competing with it. Black rather than a lower alpha: alpha is darker
  only on a dark surface and lighter on a light one, so it would settle the two tones against the
  header here and undo them anywhere else.
*/
.w-linear-progress-striped {
  --w-linear-progress-track: color-mix(in srgb, var(--w-linear-progress-color) 81%, black);

  background-image: linear-gradient(
    45deg,
    color-mix(in srgb, var(--w-linear-progress-track) 70%, transparent) 25%,
    color-mix(in srgb, var(--w-linear-progress-track) 8%, transparent) 25%,
    color-mix(in srgb, var(--w-linear-progress-track) 8%, transparent) 50%,
    color-mix(in srgb, var(--w-linear-progress-track) 70%, transparent) 50%,
    color-mix(in srgb, var(--w-linear-progress-track) 70%, transparent) 75%,
    color-mix(in srgb, var(--w-linear-progress-track) 8%, transparent) 75%
  );
  background-size: 12px 12px;
  animation: w-linear-progress-stripes 0.35s linear infinite;
}

@keyframes w-linear-progress-sheen {
  from {
    background-position-x: 0;
  }
  to {
    background-position-x: 72px;
  }
}

@keyframes w-linear-progress-stripes {
  from {
    background-position-x: 12px;
  }
  to {
    background-position-x: 0;
  }
}

.w-linear-progress-indeterminate {
  width: 50%;
  animation: w-linear-progress 1.4s ease-in-out infinite;
}

@keyframes w-linear-progress {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(200%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .w-linear-progress-indeterminate {
    animation-duration: 3s;
  }

  /*
    -> The stripes and the drift carry no information the bar does not; motion is all they are. The
       indeterminate bar's own animation is all it has to say anything with, so it is slowed above
       rather than stopped here.
  */
  .w-linear-progress-striped,
  .w-linear-progress-bar:not(.w-linear-progress-indeterminate) {
    animation: none;
  }
}
</style>
