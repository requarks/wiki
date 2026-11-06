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
          <!-- `tabindex="-1"` makes the panel itself focusable, as the place focus lands on open
               when nothing inside asks for it; never a Tab stop. -->
          <div
            ref="panelEl"
            role="dialog"
            aria-modal="true"
            tabindex="-1"
            class="w-dialog-panel pointer-events-auto flex flex-col overflow-auto shadow-dialog outline-none"
            :class="panelClasses"
            :style="panelStyle"
            @click.stop
            @keydown="onPanelKeydown">
            <slot />
          </div>
        </div>
      </transition>
    </div>
  </teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { isTopDialog, openDialogStack, tabbableIn } from '@/helpers/dialogFocus'

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
   * Blocks dismissal via backdrop click only; Escape still closes. For a dialog holding something
   * typed that a stray click would throw away, where the deliberate way out is still wanted.
   */
  noBackdropDismiss: {
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

/*
  `p-3` on the right-hand viewport is what insets the side panel from the window edges instead of
  butting it against them, which is also what lets its corners be rounded: a radius against the very
  edge of the window reads as a rendering fault rather than a shape.
*/
const VIEWPORTS = {
  right: 'items-stretch justify-end p-3',
  bottom: 'items-end justify-center',
  standard: 'items-center justify-center p-4'
}

const transitionName = computed(() => TRANSITIONS[props.position] ?? TRANSITIONS.standard)

const viewportClasses = computed(() => VIEWPORTS[props.position] ?? VIEWPORTS.standard)

const panelClasses = computed(() => [
  // -> Rounded, not square: the panel no longer touches the window, see VIEWPORTS above. A panel
  //    against the bottom edge keeps its own bottom corners square, since they sit on that edge.
  props.position === 'right' ? 'h-full rounded-lg' : '',
  props.position === 'bottom' ? 'rounded-b-none max-h-full rounded-t-lg' : '',
  props.position === 'standard' ? 'rounded-lg max-h-full' : '',
  props.fullHeight && props.position === 'standard' ? 'h-full' : '',
  props.fullWidth ? 'w-full' : ''
])

const panelStyle = computed(() =>
  !props.fullWidth && props.maxWidth ? { maxWidth: props.maxWidth } : undefined
)

// DATA

const panelEl = ref(null)

/** This instance's entry in `openDialogStack`. */
const stackToken = {}

/** Whatever held focus when the dialog opened -- usually the button that opened it. */
let returnFocusTo = null

// METHODS

function close() {
  emit('update:modelValue', false)
}

function onBackdropClick() {
  if (!props.persistent && !props.noBackdropDismiss) {
    close()
  }
}

function onKeydown(ev) {
  /*
    Every open dialog has this listener on `document`, and `stopPropagation()` does not stop other
    listeners on that same node -- so one Escape used to close every non-persistent dialog in the
    stack at once. Only the dialog on top answers it.
  */
  if (ev.key !== 'Escape' || !isTopDialog(stackToken)) {
    return
  }
  // -> A persistent dialog leaves the key alone, so a select open inside it can still close on it
  if (!props.persistent) {
    ev.stopPropagation()
    close()
  }
}

/**
 * Keeps Tab inside the panel by wrapping at either end, which `aria-modal` promises and which leaving
 * the page behind reachable broke: tabbing out and pressing Enter clicked whatever was underneath.
 *
 * Bound on the panel, in the bubble phase, rather than on `document`: a code editor inside the panel
 * claims Tab for indentation and calls `preventDefault()` on it, and that has to win. A dialog opened
 * on top of this one is teleported out of the panel, so its keys never reach here.
 */
function onPanelKeydown(ev) {
  if (ev.key !== 'Tab' || ev.defaultPrevented) {
    return
  }
  const panel = panelEl.value
  const items = tabbableIn(panel)
  if (items.length === 0) {
    ev.preventDefault()
    return
  }
  const active = document.activeElement
  if (ev.shiftKey && (active === items[0] || active === panel)) {
    ev.preventDefault()
    items.at(-1).focus()
  } else if (!ev.shiftKey && active === items.at(-1)) {
    ev.preventDefault()
    items[0].focus()
  }
}

/**
 * Moves focus into the panel once it is rendered, unless something inside already took it (a field
 * with `autofocus`, or `useDialogComponent({ autofocus })`, which runs a tick later and moves it on).
 *
 * Without this, focus stayed on the button that opened the dialog, so Enter clicked it again and
 * stacked another copy of the dialog on top -- repeatably, until the screen went black.
 */
function focusPanel() {
  const panel = panelEl.value
  if (panel && !panel.contains(document.activeElement)) {
    panel.focus({ preventScroll: true })
  }
}

/** Hands focus back to the opener, if it still exists and nothing has deliberately moved it on. */
function restoreFocus() {
  const target = returnFocusTo
  returnFocusTo = null
  const active = document.activeElement
  const focusIsOurs = !active || active === document.body || panelEl.value?.contains(active)
  if (focusIsOurs && target?.isConnected && typeof target.focus === 'function') {
    target.focus({ preventScroll: true })
  }
}

function lock() {
  document.addEventListener('keydown', onKeydown, true)
  openDialogStack.push(stackToken)
  const depth = Number(document.body.dataset.wDialogDepth ?? 0) + 1
  document.body.dataset.wDialogDepth = String(depth)
  document.body.style.overflow = 'hidden'
}

function release() {
  document.removeEventListener('keydown', onKeydown, true)
  const idx = openDialogStack.indexOf(stackToken)
  if (idx >= 0) {
    openDialogStack.splice(idx, 1)
  }
  const depth = Math.max(0, Number(document.body.dataset.wDialogDepth ?? 0) - 1)
  document.body.dataset.wDialogDepth = String(depth)
  if (depth === 0) {
    document.body.style.overflow = ''
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
  (isOpen, wasOpen) => {
    if (isOpen) {
      returnFocusTo = document.activeElement
      lock()
      // -> The panel is rendered by the flush this change triggers, not yet
      nextTick(focusPanel)
    } else if (wasOpen) {
      // -> Not on mounting closed, which has nothing to release -- that used to unlock the page's
      //    scroll under a dialog that was already open
      // -> Runs before the re-render, while the panel is still there to ask whether it holds focus
      restoreFocus()
      release()
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  // -> An unmount while open (route change, host teardown) would otherwise leak the listener, the
  //    stack entry and the scroll lock
  if (props.modelValue) {
    release()
  }
})
</script>

<style scoped>
/*
  The panel clips what is put inside it, which is what actually rounds a dialog.

  Every dialog fills its panel with something opaque -- a `WCard`, or a whole `WLayout` for the
  full-screen overlays -- and those surfaces carry bands with backgrounds of their own: a header, a row
  of actions. Left to paint themselves, they cover the panel's corners and the dialog reads as square,
  which it did. Clipping here rounds all of them at once, however deeply the band is nested.

  `auto` rather than `hidden`: both clip, but a dialog whose content outgrows the screen stays
  reachable instead of being cut off. The viewport behind it scrolls too, so nothing is trapped.
*/
/*
  The surface inside takes the panel's shape. Without this its own smaller radius shows through at the
  corners as four notches of backdrop, since the panel itself has no background of its own.

  Written flat rather than nested: nesting `> :deep(*)` inside the panel's own rule compiles to a
  DESCENDANT selector, which matches the wrong elements entirely.
*/
.w-dialog-panel > :deep(*) {
  border-radius: inherit;
}

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

/*
  A short slide in from the right, paired with a fade so a 32px move does not read as a pop.

  32px and not `100%`: a percentage resolves against the panel's OWN width, and the side panel's
  content arrives asynchronously -- so the width changed mid-transition, the percentage re-resolved
  against the new value, and the panel lurched instead of sliding. A fixed distance cannot move
  underneath the animation.
*/
.w-dialog-slide-right-enter-active,
.w-dialog-slide-right-leave-active {
  transition: opacity 0.2s var(--ease-standard);
}
.w-dialog-slide-right-enter-from,
.w-dialog-slide-right-leave-to {
  opacity: 0;
}
.w-dialog-slide-right-enter-active .w-dialog-panel,
.w-dialog-slide-right-leave-active .w-dialog-panel {
  transition: transform 0.2s var(--ease-standard);
}
.w-dialog-slide-right-enter-from .w-dialog-panel,
.w-dialog-slide-right-leave-to .w-dialog-panel {
  transform: translateX(32px);
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
