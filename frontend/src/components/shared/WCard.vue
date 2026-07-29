<template>
  <!--
    The surface colours live on `.w-card` in `@layer components` (see `css/tailwind.css`), not here.
    As utilities they outranked the `bg-negative` / `bg-info` the admin pages tint their notice cards
    with, since two background utilities are ordered within the layer rather than by who wrote them.
  -->
  <div
    class="w-card relative rounded"
    :class="[flat ? '' : 'shadow-card', horizontal ? 'flex flex-nowrap' : '']">
    <slot />
  </div>
</template>

<script setup>
/**
 * Surface container. Pair with `WCardSection` / `WCardActions` for its internal bands.
 */
defineProps({
  /** Drops the elevation shadow. */
  flat: {
    type: Boolean,
    default: false
  },
  /** Lays sections out in a row instead of stacked. */
  horizontal: {
    type: Boolean,
    default: false
  }
})
</script>
