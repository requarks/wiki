<template>
  <!--
    Single root, deliberately. The scrim is teleported to <body> rather than rendered as a sibling
    here, because a multi-root component gets no attribute fallthrough -- and every drawer in this
    app is styled by a class the caller puts on the tag (`.admin-sidebar`, `.bg-sidebar`, ...).

    `v-show` rather than `v-if`: a `display: none` grid item generates no box, so the drawer's
    column collapses to zero width exactly as if it were absent, while the element stays mounted so
    its scroll position and any child state survive being closed.
  -->
  <aside
    v-show="isVisible"
    class="w-drawer flex flex-col"
    :class="[
      side === 'right' ? 'w-drawer--right' : 'w-drawer--left',
      isOverlay ? 'w-drawer--overlay fixed inset-y-0 z-40 shadow-dialog' : '',
      isOverlay && side === 'right' ? 'right-0' : '',
      isOverlay && side !== 'right' ? 'left-0' : '',
      bordered ? borderClass : '',
      dark ? 'text-white' : ''
    ]"
    :style="{ width: `${width}px` }">
    <teleport to="body">
      <transition name="w-drawer-scrim">
        <div
          v-if="isVisible && isOverlay"
          class="fixed inset-0 z-30 bg-black/40"
          @click="$emit('update:modelValue', false)" />
      </transition>
    </teleport>
    <slot />
  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { useMinWidth } from '@/composables/screen'

/**
 * Side panel of a `WLayout`.
 *
 * Two modes, chosen by viewport width rather than by a prop:
 *   - wide   -- occupies its own grid column, pushing the page across
 *   - narrow -- overlays the page with a dismissable scrim
 *
 * `showIfAbove` reproduces the old behaviour where a drawer is open by default on a wide screen
 * whatever its model value says, and obeys the model only once the viewport is narrow.
 */
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  /** Width in pixels. */
  width: {
    type: Number,
    default: 300
  },
  side: {
    type: String,
    default: 'left',
    validator: (v) => ['left', 'right'].includes(v)
  },
  /** Force the drawer open on wide viewports, whatever the model says. */
  showIfAbove: {
    type: Boolean,
    default: false
  },
  /** Divider line between the drawer and the page. */
  bordered: {
    type: Boolean,
    default: false
  },
  /**
   * Light foreground, for a panel that is dark in both themes.
   *
   * The drawer this replaces coloured its own content when marked dark, and the admin overlays are
   * written that way. Without the prop the attribute falls through to the <aside> as a stray
   * `dark="true"` and the labels stay black on a near-black panel -- readable only where something
   * else happens to set a colour, which is how it slipped through: the ACTIVE row had its own
   * `text-white`, so only the unselected labels went missing.
   *
   * The background stays the caller's job (a class), as it already was.
   */
  dark: {
    type: Boolean,
    default: false
  }
})

defineEmits(['update:modelValue'])

/**
 * Where a drawer stops overlaying and takes its own column. 1024px is the `md` breakpoint, which is
 * where the previous implementation switched too.
 */
const isWide = useMinWidth(1024)

const isOverlay = computed(() => !isWide.value)

const isVisible = computed(() =>
  // -> On a wide screen `showIfAbove` wins; on a narrow one the model is the only thing that counts
  isWide.value ? props.showIfAbove || props.modelValue : props.modelValue
)

const borderClass = computed(() =>
  props.side === 'right'
    ? 'border-l border-black/12 dark:border-white/15'
    : 'border-r border-black/12 dark:border-white/15'
)
</script>

<style scoped>
.w-drawer--left {
  grid-area: ldrawer;
}
.w-drawer--right {
  grid-area: rdrawer;
}

/* -> An overlaying drawer is out of flow, so it must not also claim its grid column */
.w-drawer--overlay {
  grid-area: unset;
}

.w-drawer-scrim-enter-active,
.w-drawer-scrim-leave-active {
  transition: opacity 0.2s var(--ease-standard);
}
.w-drawer-scrim-enter-from,
.w-drawer-scrim-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .w-drawer-scrim-enter-active,
  .w-drawer-scrim-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
