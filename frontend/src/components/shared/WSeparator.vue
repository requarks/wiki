<template>
  <div
    role="separator"
    :aria-orientation="vertical ? 'vertical' : 'horizontal'"
    class="w-separator w-hairline shrink-0"
    :class="classes"
    :style="styles" />
</template>

<script setup>
import { computed } from 'vue'

/**
 * A dividing rule between blocks of content.
 */
const props = defineProps({
  vertical: {
    type: Boolean,
    default: false
  },
  /** Force the light-on-dark colour, for a rule on an always-dark surface. */
  dark: {
    type: Boolean,
    default: false
  },
  /** Inset the rule from the container edges, as Quasar's `inset` did. */
  inset: {
    type: Boolean,
    default: false
  },
  /** Vertical margin around a horizontal rule (`sm`, `md`, ... or a CSS length). */
  spaced: {
    type: [Boolean, String],
    default: false
  }
})

const SPACING = { sm: '8px', md: '16px', lg: '24px' }

/*
  A horizontal rule is a plain block and takes its width from the flow, exactly as Quasar's
  `.q-separator--horizontal { height: 1px; display: block }` did. It must NOT be `w-full`: combined
  with the `inset` margins that yields 100% width *plus* 32px of margin, so the rule overhangs its
  container on the right by exactly the right-hand inset.
*/
const classes = computed(() => [
  props.vertical ? 'h-auto w-px self-stretch' : 'block h-px',
  /*
    A vertical rule has to scale on the OTHER axis. The hairline trick shrinks the painted line to
    exactly one device pixel with a transform, and the base rule scales Y from `transform-origin:
    top left` -- correct for a horizontal rule, but on a vertical one it squashes the line towards
    the top of its box instead of thinning it. At a device pixel ratio of 1 the scale is 1 and
    nothing moves, which is why this looked right everywhere except on a fractionally scaled
    display, where the rule visibly rode up.
  */
  props.vertical ? 'w-hairline--vertical' : '',
  props.dark ? 'w-hairline--dark' : '',
  props.inset ? (props.vertical ? 'my-2' : 'mx-4') : ''
])

const styles = computed(() => {
  if (!props.spaced) {
    return undefined
  }
  const v = props.spaced === true ? 'sm' : props.spaced
  const size = SPACING[v] ?? v
  // -> Margin runs along the rule's cross axis, so it flips with the orientation
  return props.vertical ? { marginInline: size } : { marginBlock: size }
})
</script>
