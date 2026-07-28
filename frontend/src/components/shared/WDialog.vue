<template>
  <teleport to="body">
    <!--
      Single wrapper root, so a class on `<w-dialog>` reaches the markup and can style the backdrop
      and panel by descent (`.main-overlay > .w-dialog-backdrop`). A multi-root component gets no
      attribute fallthrough at all, which left overlays unable to carry their own styling.

      The wrapper is always present but empty while closed -- an empty div with no positioning has
      no layout or paint cost, and keeping it mounted means the leave transition has somewhere to
      run.
    -->
    <div v-bind="$attrs" class="w-dialog-root" :class="modelValue ? 'w-dialog-root--open' : ''">
      <transition name="w-dialog-backdrop">
        <div
          v-if="modelValue"
          class="w-dialog-backdrop fixed inset-0 z-[6000] bg-black/50"
          @click="onBackdropClick" />
      </transition>
      <transition :name="transitionName" @after-leave="$emit('hide')">
        <div
          v-if="modelValue"
          class="w-dialog-viewport fixed inset-0 z-[6000] flex flex-nowrap overflow-auto pointer-events-none"
          :class="viewportClasses">
          <div
            role="dialog"
            aria-modal="true"
            class="w-dialog-panel pointer-events-auto flex flex-col shadow-dialog"
            :class="panelClasses"
            :style="panelStyle"
            @click.stop>
            <slot />
          </div>
        </div>
      </transition>
    </div>
  </teleport>
</template>

<script setup>
import { computed, onBeforeUnmount, watch } from 'vue'

/**
 * Modal dialog shell.
 *
 * Covers the two placements the app uses -- a centered modal, and the right-hand side panel that
 * `SideDialog` opens. Content, including its own header/actions, comes from the default slot; this
 * component owns only the backdrop, positioning, transition and dismissal behaviour.
 */
/*
  A `<teleport>` root gets no attribute fallthrough -- Vue cannot know which of the teleported
  nodes an attribute belongs to -- so a `class` on `<w-dialog>` was being dropped with a warning
  rather than reaching the markup the overlay stylesheets select on. Bound explicitly instead.
*/
defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  /** Blocks dismissal via backdrop click and Escape. */
  persistent: {
    type: Boolean,
    default: false
  },
  /**
   * `standard` centers the panel, `right` docks it to the right edge as a side panel, `bottom`
   * anchors it to the bottom of the viewport.
   */
  position: {
    type: String,
    default: 'standard',
    validator: (v) => ['standard', 'right', 'bottom'].includes(v)
  },
  fullHeight: {
    type: Boolean,
    default: false
  },
  fullWidth: {
    type: Boolean,
    default: false
  },
  /** Any CSS length, e.g. `550px`. Ignored when `fullWidth` is set. */
  maxWidth: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'hide'])

// COMPUTED

const TRANSITIONS = {
  right: 'w-dialog-slide-right',
  bottom: 'w-dialog-slide-bottom',
  standard: 'w-dialog-scale'
}

const VIEWPORTS = {
  right: 'items-stretch justify-end',
  bottom: 'items-end justify-center',
  standard: 'items-center justify-center p-4'
}

const transitionName = computed(() => TRANSITIONS[props.position] ?? TRANSITIONS.standard)

const viewportClasses = computed(() => VIEWPORTS[props.position] ?? VIEWPORTS.standard)

const panelClasses = computed(() => [
  props.position === 'right' ? 'h-full rounded-none' : '',
  props.position === 'bottom' ? 'rounded-b-none max-h-full rounded-t' : '',
  props.position === 'standard' ? 'rounded max-h-full' : '',
  props.fullHeight && props.position === 'standard' ? 'h-full' : '',
  props.fullWidth ? 'w-full' : ''
])

const panelStyle = computed(() =>
  !props.fullWidth && props.maxWidth ? { maxWidth: props.maxWidth } : undefined
)

// METHODS

function close() {
  emit('update:modelValue', false)
}

function onBackdropClick() {
  if (!props.persistent) {
    close()
  }
}

function onKeydown(ev) {
  if (ev.key === 'Escape' && !props.persistent) {
    // -> Stops the key also reaching a dialog underneath this one
    ev.stopPropagation()
    close()
  }
}

// WATCHERS

/**
 * Escape handling and scroll-locking are bound only while open, so stacked dialogs do not each keep
 * a listener alive. The lock is reference-counted on a data attribute because a dialog can open on
 * top of another -- releasing on the first close would unlock the page while a dialog is still up.
 */
watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      document.addEventListener('keydown', onKeydown, true)
      const depth = Number(document.body.dataset.wDialogDepth ?? 0) + 1
      document.body.dataset.wDialogDepth = String(depth)
      document.body.style.overflow = 'hidden'
    } else {
      document.removeEventListener('keydown', onKeydown, true)
      const depth = Math.max(0, Number(document.body.dataset.wDialogDepth ?? 0) - 1)
      document.body.dataset.wDialogDepth = String(depth)
      if (depth === 0) {
        document.body.style.overflow = ''
      }
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  // -> An unmount while open (route change, host teardown) would otherwise leak both
  if (props.modelValue) {
    document.removeEventListener('keydown', onKeydown, true)
    const depth = Math.max(0, Number(document.body.dataset.wDialogDepth ?? 0) - 1)
    document.body.dataset.wDialogDepth = String(depth)
    if (depth === 0) {
      document.body.style.overflow = ''
    }
  }
})
</script>

<style scoped>
.w-dialog-backdrop-enter-active,
.w-dialog-backdrop-leave-active {
  transition: opacity 0.2s var(--ease-standard);
}
.w-dialog-backdrop-enter-from,
.w-dialog-backdrop-leave-to {
  opacity: 0;
}

.w-dialog-scale-enter-active,
.w-dialog-scale-leave-active {
  transition: opacity 0.2s var(--ease-standard);
}
.w-dialog-scale-enter-active .w-dialog-panel,
.w-dialog-scale-leave-active .w-dialog-panel {
  transition: transform 0.2s var(--ease-standard);
}
.w-dialog-scale-enter-from,
.w-dialog-scale-leave-to {
  opacity: 0;
}
.w-dialog-scale-enter-from .w-dialog-panel,
.w-dialog-scale-leave-to .w-dialog-panel {
  transform: scale(0.94);
}

.w-dialog-slide-right-enter-active .w-dialog-panel,
.w-dialog-slide-right-leave-active .w-dialog-panel {
  transition: transform 0.25s var(--ease-standard);
}
.w-dialog-slide-right-enter-from .w-dialog-panel,
.w-dialog-slide-right-leave-to .w-dialog-panel {
  transform: translateX(100%);
}

.w-dialog-slide-bottom-enter-active .w-dialog-panel,
.w-dialog-slide-bottom-leave-active .w-dialog-panel {
  transition: transform 0.25s var(--ease-standard);
}
.w-dialog-slide-bottom-enter-from .w-dialog-panel,
.w-dialog-slide-bottom-leave-to .w-dialog-panel {
  transform: translateY(100%);
}

@media (prefers-reduced-motion: reduce) {
  .w-dialog-backdrop-enter-active,
  .w-dialog-backdrop-leave-active,
  .w-dialog-scale-enter-active,
  .w-dialog-scale-leave-active,
  .w-dialog-scale-enter-active .w-dialog-panel,
  .w-dialog-scale-leave-active .w-dialog-panel,
  .w-dialog-slide-right-enter-active .w-dialog-panel,
  .w-dialog-slide-right-leave-active .w-dialog-panel,
  .w-dialog-slide-bottom-enter-active .w-dialog-panel,
  .w-dialog-slide-bottom-leave-active .w-dialog-panel {
    transition-duration: 0.01ms;
  }
}
</style>
