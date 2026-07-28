<template>
  <span
    class="w-spinner shrink-0 rounded-full border-current border-r-transparent align-middle"
    :style="style"
    role="presentation" />
</template>

<script setup>
import { computed } from 'vue'

/**
 * Indeterminate spinner.
 *
 * Simplification: this replaces a family of spinners (tail, rings, clock, infinity, ...) that were
 * picked more or less at random across the admin area. They all mean "working"; one is enough.
 */
const props = defineProps({
  /** A named size, or any CSS length. */
  size: {
    type: String,
    default: '24px'
  },
  /** Ring thickness, as a CSS length. */
  thickness: {
    type: String,
    default: '2px'
  },
  /** Theme color name. Omit to inherit the surrounding text color. */
  color: {
    type: String,
    default: null
  }
})

/** The named sizes the icon components use, so `size="sm"` means the same thing everywhere. */
const NAMED_SIZES = {
  xs: '18px',
  sm: '24px',
  md: '32px',
  lg: '38px',
  xl: '46px'
}

const style = computed(() => {
  const size = NAMED_SIZES[props.size] ?? props.size
  return {
    width: size,
    height: size,
    borderWidth: props.thickness,
    color: props.color ? `var(--color-${props.color})` : undefined
  }
})
</script>

<style scoped>
.w-spinner {
  /*
    `display` is set here rather than with an `inline-block` utility on purpose. Quasar declares
    `.inline-block { display: inline-block !important }` unlayered, and an !important stylesheet
    rule beats a non-important inline style -- which defeats `v-show`, leaving the spinner
    permanently visible. A scoped rule has no !important, so `v-show` wins as it should.
  */
  display: inline-block;
  border-style: solid;
  animation: w-spinner 0.7s linear infinite;
}

@keyframes w-spinner {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .w-spinner {
    animation-duration: 2s;
  }
}
</style>
