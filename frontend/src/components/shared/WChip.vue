<template>
  <!--
    A chip is a single nowrap line, so its height is its line box plus padding; the line height
    comes with the font size, from `SIZES` below. See the note there.

    The label is `self-baseline` so that it, not a leading icon, is the chip's baseline when a
    baseline-aligned row lines text up against one. Being the tallest item, it does not move.
  -->
  <div
    class="w-chip inline-flex max-w-full flex-nowrap items-center gap-1.5 align-middle"
    :class="classes"
    :style="styles"
    :tabindex="clickable ? 0 : undefined"
    :role="clickable ? 'button' : undefined"
    @click="clickable && $emit('click', $event)"
    @keydown.enter.prevent="clickable && $emit('click', $event)">
    <w-icon v-if="icon" :name="icon" class="shrink-0" />
    <span class="truncate self-baseline">
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

/*
  Each size's line height is a whole number of pixels, picked so that the label is centred.

  Around 1.25em, rather than the inherited 1.5, which made a chip noticeably taller than the text it
  wraps; at least the glyph box, since the label span clips its overflow and descenders would be cut.
  But not 1.25 itself: at 14px that is a 17.5px line box, and the half pixel is resolved differently
  depending on where the chip lands on the device pixel grid -- measured 1px high at one position
  and 0.5px at the next, up to 1.4px at 125% display scaling. And not merely rounded either: Chrome
  rounds Roboto's ascent and descent to whole pixels, and when what the line box leaves over that
  is odd, the spare pixel goes below the glyphs and the label sits a pixel high (12px on 15, 16px on
  20). These leave an even remainder, which keeps every size within half a pixel of centre at every
  scale measured, 100% to 200%.

  A size given as a CSS length gets 1.25em rounded to a pixel, which settles the first problem and
  leaves the second to chance.
*/
const SIZES = {
  xs: { fontSize: '10px', lineHeight: '13px' },
  sm: { fontSize: '12px', lineHeight: '16px' },
  md: { fontSize: '14px', lineHeight: '18px' },
  lg: { fontSize: '16px', lineHeight: '21px' }
}

const classes = computed(() => [
  props.square ? 'rounded-sm' : 'rounded-full',
  props.dense ? 'px-2 py-0.5' : 'px-3 py-1',
  props.clickable ? 'cursor-pointer hover:brightness-110' : '',
  // -> Uncoloured chips fall back to a neutral surface tint rather than being invisible
  props.color ? '' : 'bg-black/8 dark:bg-white/12'
])

const styles = computed(() => ({
  ...(SIZES[props.size] ?? { fontSize: props.size, lineHeight: 'round(1.25em, 1px)' }),
  backgroundColor: props.color ? `var(--color-${props.color})` : undefined,
  color: props.textColor ? `var(--color-${props.textColor})` : undefined
}))
</script>

<style scoped>
/*
  An avatar inside a chip is sized by the chip, not by the 48px it takes standing on its own -- that
  default made a 12px-font chip 56px tall, swallowing the row. Same reason WItemSection overrides it
  for a flanking section, and the box has to be restated for the same reason too: the chip this
  replaces derived an avatar's dimensions from its font size, ours does not.

  Relative rather than the fixed px used for item metrics, because a chip's own font size is a prop
  (10-16px) and the avatar has to track it.

  `font-size: inherit` is load-bearing: it keeps the avatar on the CHIP's font size, so the `em`
  lengths below are chip-ems. Were a font size set here instead, they would resolve against it.

  1.25em fits the line box the chip's size gives it (`SIZES`), so the avatar sits WITHIN the label's
  line instead of setting the chip's height. Anything taller becomes the tallest thing in the box and
  the chip grows around it, which is what made it stand a row tall.

  A descendant selector, not a child one: everything slotted lands inside the truncating <span> in
  the template, so an avatar written between the chip's tags is a grandchild. That also means the
  chip's own `gap` does not separate it from the label -- they are inline siblings inside that span,
  with nothing between them -- so the gap has to be a margin here.
*/
.w-chip :deep(.w-avatar) {
  width: 1.25em;
  height: 1.25em;
  font-size: inherit;
  margin-right: 0.45em;
}

/* -> Which leaves the glyph to scale separately, at a little over two thirds of the circle */
.w-chip :deep(.w-avatar > .w-icon) {
  font-size: 0.85em;
}
</style>
