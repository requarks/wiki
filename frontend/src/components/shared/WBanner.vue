<template>
  <div
    class="w-banner flex gap-4 rounded p-4"
    :class="[dense ? 'py-2' : '', inlineActions ? 'flex-nowrap items-center' : 'flex-wrap']">
    <div v-if="$slots.avatar" class="flex shrink-0 items-center">
      <slot name="avatar" />
    </div>
    <div class="min-w-0 flex-1 text-body2">
      <slot />
    </div>
    <div
      v-if="$slots.action"
      class="flex shrink-0 flex-nowrap items-center gap-2"
      :class="inlineActions ? '' : 'ml-auto'">
      <slot name="action" />
    </div>
  </div>
</template>

<script setup>
/**
 * Prominent inline message with an optional leading icon and trailing actions.
 *
 * Carries no colour of its own -- callers set the surface with a utility class, which is how the
 * existing banners are already written.
 */
defineProps({
  dense: {
    type: Boolean,
    default: false
  },
  /** Keeps the actions on the same row rather than wrapping them below. */
  inlineActions: {
    type: Boolean,
    default: false
  }
})
</script>
