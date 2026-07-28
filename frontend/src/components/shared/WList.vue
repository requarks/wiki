<template>
  <div class="w-list" :class="classes">
    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue'

/**
 * Vertical list container for `WItem` children.
 *
 * `separator` draws the dividing rules itself (via a child combinator) rather than requiring a
 * separator element between every pair of items, which is how the markup already reads.
 */
const props = defineProps({
  /** Rule between adjacent items. */
  separator: {
    type: Boolean,
    default: false
  },
  /** Vertical padding around the list as a whole. */
  padding: {
    type: Boolean,
    default: false
  },
  /** Outer border. */
  bordered: {
    type: Boolean,
    default: false
  },
  /** Reduces the height of every item in the list. */
  dense: {
    type: Boolean,
    default: false
  },
  /**
   * Renders for a dark surface regardless of the app theme. Needed where a list sits on a panel
   * that is dark in both themes (the admin sidebar), so the separators cannot key off `dark:`.
   */
  dark: {
    type: Boolean,
    default: false
  }
})

const classes = computed(() => [
  props.padding ? 'py-2' : '',
  props.bordered ? 'rounded border border-black/12 dark:border-white/15' : '',
  props.separator ? 'w-list--separator' : '',
  props.dense ? 'w-list--dense' : '',
  props.dark ? 'w-list--dark' : ''
])
</script>

<style scoped>
/*
  Hover feedback for a list that is dark whatever the app theme.

  A row's own hover is a black tint, swapped for a white one by the `dark:` variant -- but that
  variant keys off the app theme, and the admin sidebar is dark in light mode too. There the black
  tint lands on an already-dark panel and is invisible, which is the whole reason this exists.
*/
@media (hover: hover) {
  .w-list--dark :deep(> .w-item--clickable:not(:has(:disabled)):hover) {
    background-color: rgb(255 255 255 / 0.14);
  }
}

.w-list--dark :deep(> .w-item--clickable:not(:has(:disabled)):active) {
  background-color: rgb(255 255 255 / 0.22);
}

/*
  A dense list compresses its own items, rather than every row having to be told separately -- the
  admin sidebar sets it once on the list. Same metrics as the row's own `dense`.
*/
.w-list--dense :deep(> .w-item) {
  min-height: 32px;
  padding-top: 2px;
  padding-bottom: 2px;
}

/*
  `:deep` because the items are supplied by the consumer's slot content and so carry that
  component's scope attribute, not this one's.

  Drawn as a scaled pseudo-element rather than `border-top: 1px`, for the same reason as
  `.w-hairline`: a 1px CSS border lands on fractional device rows under display scaling and comes
  out inconsistently thick. This keeps every rule at exactly one device pixel.
*/
.w-list--separator :deep(> * + *) {
  position: relative;
}

.w-list--separator :deep(> * + *)::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background-color: rgb(0 0 0 / 0.12);
  transform: scaleY(calc(1 / var(--w-dpr, 1)));
  transform-origin: top left;
  pointer-events: none;
}

:global(body.body--dark .w-list--separator > * + *::before),
.w-list--separator.w-list--dark :deep(> * + *)::before {
  background-color: rgb(255 255 255 / 0.15);
}
</style>
