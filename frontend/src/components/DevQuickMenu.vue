<template>
  <!--
    A tab hanging off the top edge of the viewport, mostly above it: all that shows at rest is a lip,
    enough to find and click without standing in front of the app. Pointing at it (or opening the
    menu) slides the whole thing into view.
  -->
  <button
    type="button"
    class="dev-tab w-unstyled font-robotomono"
    :class="{ 'is-open': state.menuShown }"
    aria-label="Developer tools"
    :aria-expanded="state.menuShown"
    @click="state.menuShown = !state.menuShown">
    dev
    <!--
      Controlled, rather than letting WMenu bind the trigger itself: the tab stays slid down for as
      long as the menu is open, which means this component has to know.
    -->
    <w-menu v-model="state.menuShown" anchor="bottom middle" self="top middle" :offset="[0, 4]">
      <w-list dense style="min-width: 260px">
        <w-item tag="label">
          <w-item-section>
            <w-item-label>Dark mode</w-item-label>
            <w-item-label caption>
              This session only. A reload restores the saved appearance.
            </w-item-label>
          </w-item-section>
          <w-item-section side>
            <w-toggle v-model="isDark" />
          </w-item-section>
        </w-item>
      </w-list>
    </w-menu>
  </button>
</template>

<script setup>
import { computed, reactive } from 'vue'

import { useDark } from '@/composables/dark'

/**
 * Developer quick menu — mounted only by a dev server, never built into a release. See the guard in
 * `App.vue`, which is what keeps this out of the production bundle entirely.
 *
 * Switches that belong here are the ones worth flipping while looking at a screen, without an
 * account, a setting, or a reload: throwaway state that the app should forget on its own. Add rows to
 * the list; the tab is deliberately narrow and dumb.
 *
 * Strings are hardcoded English rather than going through `t()`. Nothing in here should reach the
 * translators, and a dev-only key in `en.json` would be shipped to them on the next sync.
 */

// DARK MODE

const dark = useDark()

// DATA

const state = reactive({
  menuShown: false
})

// COMPUTED

/*
  Writes straight to the body class through the composable, deliberately going around
  `userStore.appearance`: that one is persisted per user, and the point of this switch is to try the
  other theme on for a minute. Nothing saves it, so the next boot applies the stored appearance as
  usual -- as does anything that re-runs `applyTheme()` in App.vue, e.g. changing the real setting.
*/
const isDark = computed({
  get: () => dark.isActive,
  set: (value) => dark.set(value)
})
</script>

<style scoped lang="scss">
.dev-tab {
  position: fixed;
  top: -14px;
  left: 50%;
  /* -> Over everything the app itself can draw: notifications (9000), tooltips (7000), menus (6500+) */
  z-index: 9999;
  display: flex;
  height: 30px;
  align-items: flex-end;
  /* -> The label sits against the bottom edge, so it stays legible in the 16px lip that shows */
  padding: 0 12px 3px;
  border-radius: 0 0 5px 5px;
  background-color: #7c3aed;
  box-shadow: 0 1px 6px rgb(0 0 0 / 0.35);
  color: #fff;
  font-size: 11px;
  line-height: 1;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transform: translateX(-50%);
  transition: top 0.15s var(--ease-standard);
}

.dev-tab:hover,
.dev-tab.is-open {
  top: 0;
}

@media (prefers-reduced-motion: reduce) {
  .dev-tab {
    transition-duration: 0.01ms;
  }
}
</style>
