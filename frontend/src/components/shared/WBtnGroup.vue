<template>
  <div
    class="w-btn-group inline-flex flex-nowrap align-middle"
    :class="unelevated ? 'w-btn-group--unelevated' : ''">
    <slot />
  </div>
</template>

<script setup>
/**
 * Joins adjacent `WBtn`s into one control: the outer corners stay rounded, the inner ones square
 * up, and the seam between two buttons is a single hairline rather than two adjacent edges.
 */
defineProps({
  /**
   * Drops the elevation from the whole group. Set here rather than on each button, since the
   * buttons read as one surface and their individual shadows would show through the seams.
   */
  unelevated: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
/*
  `:deep` because the buttons come from the consumer's slot content and carry that component's
  scope attribute rather than this one's.
*/
.w-btn-group :deep(> .w-btn:not(:first-child)) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.w-btn-group :deep(> .w-btn:not(:last-child)) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  /*
    The seam is a border rather than an inset shadow so that `unelevated` -- which is about the
    drop shadow -- can switch the one off without also erasing the other.
  */
  border-right: 1px solid rgb(0 0 0 / 0.12);
}

:global(body.body--dark .w-btn-group > .w-btn:not(:last-child)) {
  border-right-color: rgb(255 255 255 / 0.15);
}

.w-btn-group--unelevated :deep(> .w-btn) {
  box-shadow: none;
}
</style>
