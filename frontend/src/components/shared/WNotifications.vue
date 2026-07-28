<template>
  <teleport to="body">
    <div
      class="w-notifications fixed top-0 left-1/2 z-[9000] flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 p-2 pointer-events-none">
      <transition-group name="w-notification">
        <div
          v-for="n of queue"
          :key="n.id"
          role="alert"
          aria-live="polite"
          class="w-notification pointer-events-auto relative flex w-full flex-nowrap items-center gap-3 rounded py-2 pr-2 pl-4 shadow-menu"
          :class="n.classes">
          <w-icon :name="n.icon" size="sm" class="shrink-0" />
          <div class="min-w-0 flex-1 py-1">
            <div class="text-body2 break-words">{{ n.message }}</div>
            <div v-if="n.caption" class="text-caption break-words opacity-75">{{ n.caption }}</div>
          </div>
          <button
            type="button"
            :aria-label="t('common.actions.close')"
            class="w-unstyled shrink-0 cursor-pointer rounded-full p-1 leading-none opacity-70 transition-opacity hover:opacity-100"
            @click="dismiss(n.id)">
            <w-icon name="mdi:close" size="xs" />
          </button>
          <!--
            Keyed on the count so a repeat replaces the element: a CSS animation does not restart
            when its element merely re-renders, so a merged toast would otherwise keep running the
            original countdown, empty the bar, and then sit there for the remainder of its
            restarted timer with nothing left to show.
          -->
          <div
            v-if="n.timeout > 0"
            :key="`${n.id}-${n.count}`"
            class="w-notification-progress absolute bottom-0 left-0 h-[3px] rounded-b bg-white/40"
            :style="{ animationDuration: `${n.timeout}ms` }" />
          <!--
            How many times this notification has been raised while on screen. `aria-hidden`
            because the count is already spoken: each repeat re-fires the alert.

            Keyed on the count for the same reason as the progress bar: replacing the element is
            what restarts its animation, and the bounce is the whole point -- a number quietly
            changing from 2 to 3 in the corner is easy to miss.

            `bg-[var(--color-orange)]` rather than `bg-orange`, since Quasar declares that class
            unlayered with `!important` and would win. Phase 5 can use the plain utility.
          -->
          <span
            v-if="n.count > 1"
            :key="`${n.id}-count-${n.count}`"
            class="w-notification-count absolute -bottom-1.5 -left-1.5 flex h-5 min-w-5 items-center justify-center rounded-md bg-[var(--color-orange)] px-1 text-[11px] leading-none font-medium text-black shadow-menu"
            aria-hidden="true">
            {{ n.count }}
          </span>
        </div>
      </transition-group>
    </div>
  </teleport>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { dismiss, queue } from '@/composables/notify'

/**
 * Renders the notification stack. Mounted once, in App.vue -- notifications are pushed from
 * anywhere via `notify()` in `composables/notify.js`.
 */

// I18N

const { t } = useI18n()
</script>

<style scoped>
/* The container's own padding, shared so the leave rule below cannot drift away from it */
.w-notifications {
  --w-notifications-inset: 0.5rem;
}

.w-notification-progress {
  animation: w-notification-progress linear forwards;
}

.w-notification-count {
  animation: w-notification-count-bounce 0.45s var(--ease-standard);
}

/* Overshoot, settle back past the resting size, then land -- a spring rather than a pop */
@keyframes w-notification-count-bounce {
  0% {
    transform: scale(0.4);
  }
  45% {
    transform: scale(1.35);
  }
  70% {
    transform: scale(0.92);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes w-notification-progress {
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
}

.w-notification-enter-active,
.w-notification-leave-active {
  transition:
    opacity 0.3s var(--ease-standard),
    transform 0.3s var(--ease-standard);
}
.w-notification-enter-from,
.w-notification-leave-to {
  opacity: 0;
  transform: translateY(-24px);
}
/*
  Takes the leaving toast out of flow, so the ones below it close the gap under TransitionGroup's
  move transition instead of jumping.

  The insets are pinned rather than left to the static position. An absolutely positioned child
  resolves its offsets against the nearest positioned ancestor's PADDING box, so a `w-full` toast
  grew by the container's padding the instant it left the flow -- a sideways jump part-way through
  the fade. These reproduce that padding, holding the leaving toast exactly where it already was.
*/
.w-notification-leave-active {
  position: absolute;
  left: var(--w-notifications-inset);
  right: var(--w-notifications-inset);
  width: auto;
}
.w-notification-move {
  transition: transform 0.3s var(--ease-standard);
}

@media (prefers-reduced-motion: reduce) {
  .w-notification-enter-active,
  .w-notification-leave-active,
  .w-notification-move {
    transition-duration: 0.01ms;
  }
  .w-notification-progress,
  .w-notification-count {
    animation: none;
  }
}
</style>
