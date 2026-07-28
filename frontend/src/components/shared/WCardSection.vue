<template>
  <div class="w-card-section" :class="horizontal ? 'flex flex-nowrap items-center px-4' : 'p-4'">
    <slot />
  </div>
</template>

<script setup>
/**
 * A band within a `WCard`. Provides the standard padding and nothing else.
 */
defineProps({
  /** Row layout with horizontal-only padding, for sections that sit side by side. */
  horizontal: {
    type: Boolean,
    default: false
  }
})
</script>
