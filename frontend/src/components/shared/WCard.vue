<template>
  <!--
    `bg-[var(--color-white)]` rather than `bg-white`, and likewise for the text colour: Quasar defines
    `.bg-white { background: #fff !important }` unlayered, which outranks every layered Tailwind rule
    including the `dark:` variant -- so the plain utility would pin this surface to white in dark mode.
    An arbitrary-value utility has a class name Quasar does not define, so the variant works.
    Phase 5 can put the plain utilities back.
  -->
  <div
    class="w-card relative rounded bg-[var(--color-white)] text-[var(--color-black)] dark:bg-dark-3 dark:text-white"
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
