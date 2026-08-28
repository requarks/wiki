<template>
  <div
    class="w-bar flex w-full flex-nowrap items-center"
    :class="[dense ? 'w-bar--dense' : 'w-bar--standard', { 'w-bar--flush': flush }]">
    <slot />
  </div>
</template>

<script setup>
/**
 * Slim horizontal bar, used for secondary toolbars inside a drawer or card.
 *
 * Metrics taken from Quasar's own variables so migrated chrome keeps its exact size:
 *   standard  height 32px (16px inner font x2), padding 0 12px, font-size 18px, buttons 11px
 *   dense     height 24px (14px + 10),          padding 0 8px,  font-size 14px, buttons 8px
 *
 * `flush` drops the side padding, for a bar whose contents are meant to reach its edges -- a single
 * full-width button rather than a row of controls inset from the sides.
 */
defineProps({
  dense: {
    type: Boolean,
    default: false
  },
  flush: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
.w-bar {
  background: rgb(0 0 0 / 0.2);
}

.w-bar--standard {
  height: 32px;
  padding: 0 12px;
  font-size: 18px;
}

.w-bar--dense {
  height: 24px;
  padding: 0 8px;
  font-size: 14px;
}

/* -> After the two size rules, so it overrides whichever of them is in play */
.w-bar--flush {
  padding-left: 0;
  padding-right: 0;
}

/*
  Quasar sized buttons inside a bar well below the bar's own font size, and spaced them by 2px.
  Reproduced here so a bar full of buttons keeps its compact look.
*/
.w-bar--standard :deep(.w-btn) {
  font-size: 11px;
}

.w-bar--dense :deep(.w-btn) {
  font-size: 8px;
}

.w-bar :deep(> * + *) {
  margin-left: 2px;
}
</style>
