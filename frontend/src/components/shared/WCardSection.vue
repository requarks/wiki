<template>
  <div class="w-card-section" :class="horizontal ? 'flex flex-nowrap items-center' : 'p-4'">
    <slot />
  </div>
</template>

<script setup>
/**
 * A band within a `WCard`. Provides the standard padding and nothing else.
 */
defineProps({
  /**
   * Row layout, for sections that sit side by side.
   *
   * Carries no padding of its own, matching the section this replaces. A horizontal section wraps
   * other sections, and each of those already pads itself, so padding here adds to theirs rather
   * than replacing it: the `px-4` it started with is why the icon in every notice banner sat 32px
   * from the card edge instead of 16px. Zero is also what lets a horizontal card put an image flush
   * against its edge.
   */
  horizontal: {
    type: Boolean,
    default: false
  }
})
</script>
