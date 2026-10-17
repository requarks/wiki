<template>
  <teleport to="body">
    <div
      v-if="siteStore.theme.showPageProgress"
      class="page-progress pointer-events-none fixed inset-x-0 top-0 z-[9500]"
      :class="isActive ? '' : 'page-progress--done'"
      aria-hidden="true">
      <div :key="run" class="page-progress-bar" :style="{ transform: `scaleX(${progress})` }" />
    </div>
  </teleport>
</template>

<script setup>
import { isActive, progress, run } from '@/composables/pageProgress'
import { useSiteStore } from '@/stores/site'

/**
 * The progress bar along the top edge of the viewport. Mounted once, in App.vue; driven by
 * `pageProgress.start()` in `composables/pageProgress.js`.
 *
 * Fixed and above everything, so that it draws OVER the header rather than pushing it down -- the
 * layout is the same with and without it. Hidden from assistive technology: the header's spinner
 * already says the router is busy, and a bar that only ever estimates has nothing true to announce.
 *
 * A site can turn it off under Admin -> Theme -> Animations. Only the drawing is switched off: the
 * composable goes on counting either way, which costs nothing and means nothing that starts a load
 * has to know about the setting.
 */

const siteStore = useSiteStore()
</script>

<style scoped>
.page-progress {
  height: 1px;
}

/*
  Only the way out is faded: the transition is on the done state, so arriving at it fades and leaving
  it -- the next load starting -- is immediate.
*/
.page-progress--done {
  opacity: 0;
  transition: opacity 0.3s ease;
}

/*
  Scaled rather than resized, so that creeping forward is a compositor job and not a layout. The
  gradient scales with it, which keeps the secondary colour at the leading edge however far along it
  is.
*/
.page-progress-bar {
  height: 100%;
  background: linear-gradient(to right, var(--q-primary), var(--q-secondary));
  box-shadow: 0 0 6px color-mix(in srgb, var(--q-primary) 50%, transparent);
  transform-origin: left center;
  transition: transform 0.2s ease;
}
</style>
