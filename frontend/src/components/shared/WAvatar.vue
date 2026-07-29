<template>
  <!--
    `relative` so a `<w-badge floating>` in the slot pins to THIS box. Without it the badge kept
    looking for a positioned ancestor and found the surrounding card, which put the blueprint icon's
    indicator dot in the card's far top-right corner instead of on the icon.

    Deliberately NOT `overflow-hidden`, for the same reason: a floating badge is meant to overhang
    the corner, and a clipping avatar would cut it in half. An image is instead clipped by taking
    this box's own radius, as the avatar this replaces did -- see `.w-avatar > img` in
    `css/tailwind.css`.
  -->
  <div
    class="w-avatar relative inline-flex shrink-0 items-center justify-center align-middle"
    :class="shapeClass"
    :style="styles">
    <w-icon v-if="icon" :name="icon" />
    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue'

/**
 * Circular (or squared) container for an image, icon or initials.
 */
const props = defineProps({
  /**
   * Any CSS length, or one of the named sizes. Omit it to take the default from CSS, which is what
   * lets a context set the size -- an avatar in an item's flanking section is smaller. An explicit
   * value renders as an inline style and beats both.
   */
  size: {
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
  icon: {
    type: String,
    default: null
  },
  /** Square with sharp corners. */
  square: {
    type: Boolean,
    default: false
  },
  /** Square with rounded corners. */
  rounded: {
    type: Boolean,
    default: false
  },
  /** Glyph size within the avatar; defaults to 60% of `size`. */
  fontSize: {
    type: String,
    default: null
  }
})

const NAMED_SIZES = { xs: '18px', sm: '24px', md: '32px', lg: '38px', xl: '46px' }

const shapeClass = computed(() => {
  if (props.square) {
    return 'rounded-none'
  }
  if (props.rounded) {
    return 'rounded'
  }
  return 'rounded-full'
})

const styles = computed(() => {
  const size = props.size ? (NAMED_SIZES[props.size] ?? props.size) : null
  return {
    width: size ?? undefined,
    height: size ?? undefined,
    // -> Keeps an icon or initials proportional to the avatar without a second prop at every site
    fontSize: props.fontSize ?? (size ? `calc(${size} * 0.6)` : undefined),
    backgroundColor: props.color ? `var(--color-${props.color})` : undefined,
    color: props.textColor ? `var(--color-${props.textColor})` : undefined
  }
})
</script>

<style scoped>
/* Default size, in CSS rather than inline so a context (see WItemSection) can override it. */
.w-avatar {
  width: 48px;
  height: 48px;
  font-size: 28.8px;
}
</style>
