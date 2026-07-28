<template>
  <component :is="header ? 'div' : 'span'" :class="classes" :style="clampStyle">
    <slot />
  </component>
</template>

<script setup>
import { computed } from 'vue'

/**
 * A line of text inside a `WItemSection`. Plain by default, `caption` for the dimmed secondary
 * line, `header` for a group heading between items.
 */
const props = defineProps({
  /** Smaller, dimmed secondary line. */
  caption: {
    type: Boolean,
    default: false
  },
  /** Group heading rather than item content. */
  header: {
    type: Boolean,
    default: false
  },
  /** Clamp to this many lines, ellipsising the overflow. */
  lines: {
    type: [String, Number],
    default: null
  }
})

const classes = computed(() => [
  'w-item-label',
  // -> 16px on every side, as the group headings between items have always been
  props.header ? 'w-item-label--header p-4 text-body2 text-black/54 dark:text-white/70' : '',
  props.caption && !props.header ? 'w-item-label--caption text-caption text-black/54 dark:text-white/70' : '',
  !props.caption && !props.header ? 'text-body2' : '',
  // -> `truncate` covers the single-line case; more than one needs line-clamp
  Number(props.lines) === 1 ? 'truncate' : ''
])

/**
 * Multi-line clamping. Inline rather than a `line-clamp-<n>` utility because the count comes from a
 * prop, and Tailwind can only generate a class it can see as literal text in the source.
 */
const clampStyle = computed(() =>
  Number(props.lines) > 1
    ? {
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: String(props.lines),
        overflow: 'hidden'
      }
    : undefined
)
</script>
