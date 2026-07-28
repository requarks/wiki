<template>
  <div class="w-toolbar flex min-h-[50px] w-full flex-nowrap items-center px-3">
    <slot />
  </div>
</template>

<script setup>
 /**
 * Horizontal bar of controls, used inside headers and card headings.
 *
 * Matches Quasar's toolbar metrics exactly: `min-height: 50px`, `padding: 0 12px`, and crucially
 * NO gap. Spacing between items comes from the items' own margins (`ml-4` and friends), which is
 * how the existing headers are written -- adding a gap here silently widened every one of them.
 */
</script>
