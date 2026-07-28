<template>
  <!--
    `bg-[var(--color-white)]` rather than `bg-white`, and likewise for the text colour: Quasar defines
    `.bg-white { background: #fff !important }` unlayered, which outranks every layered Tailwind rule
    including the `dark:` variant -- so the plain utility would pin this surface to white in dark mode.
    An arbitrary-value utility has a class name Quasar does not define, so the variant works.
    Phase 5 can put the plain utilities back.
  -->
  <span ref="placeholderEl" class="hidden" aria-hidden="true" />
  <teleport to="body">
    <!-- Click-away catcher; transparent, and below the menu itself -->
    <div
      v-if="shown"
      class="fixed inset-0"
      :style="{ zIndex: catcherZ }"
      @click="hide"
      @contextmenu.prevent="hide" />
    <transition name="w-menu">
      <div
        v-if="shown"
        ref="floatEl"
        role="menu"
        v-bind="$attrs"
        class="w-menu fixed overflow-auto rounded shadow-menu"
        :class="[surfaceClass, contentClass]"
        :style="[floatStyle, { zIndex: catcherZ + 1 }]"
        @click="onContentClick">
        <slot />
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { POPUP_CLOSE } from '@/composables/popup'
import { anchoredPosition } from '@/composables/anchoredPosition'

/*
  The root is a fragment -- an inline placeholder that marks the trigger, plus a teleported popup --
  so Vue cannot decide for itself which half an attribute belongs to, and drops it with a warning.

  Everything belongs to the popup. This matters most for `class`: the menu this replaces put its own
  root IN the popup, so `<q-menu class="translucent-menu">` styled the popup, and that spelling is
  all over the app alongside the explicit `content-class`. Forwarding attrs here keeps both working
  rather than leaving the plain-`class` sites silently unstyled.
*/
defineOptions({ inheritAttrs: false })

/*
  Nesting depth, so a menu opened from inside another menu stacks ABOVE it.

  Each menu lays a full-screen catcher just under its own popup to dismiss it on an outside click.
  With one fixed pair of z-indexes for every menu, an inner menu's catcher sits at the same level as
  the outer one's -- and therefore UNDERNEATH the outer menu's content. Clicking the outer panel
  then never reaches the inner catcher, so a select's dropdown inside a menu could only be dismissed
  by clicking somewhere outside the menu entirely.

  Injected from the enclosing menu, if there is one, and re-provided for anything nested deeper.
  Slot content is mounted inside this component's subtree, so a control written between the menu's
  tags still inherits the value.
*/
const POPUP_DEPTH = Symbol.for('w-popup-depth')
const depth = inject(POPUP_DEPTH, 0) + 1
provide(POPUP_DEPTH, depth)

/*
  A way for content rendered inside the menu to dismiss it -- what `v-close-popup` used to do, minus
  the directive. Content mounted through the default slot lives in this component's subtree, so it
  inherits the provide even though it is written at the call site.
*/
provide(POPUP_CLOSE, () => hide())

/**
 * Base 6500, a step per level. Capped so deep nesting cannot climb over the tooltip (7000) and
 * notification (9000) layers, which must stay on top of any menu.
 */
const catcherZ = 6500 + Math.min(depth - 1, 40) * 10

/**
 * Dropdown menu anchored to its parent element, written as the last child of its trigger:
 *
 *   <w-btn label="Language">
 *     <w-menu auto-close anchor="bottom right" self="top right"> ... </w-menu>
 *   </w-btn>
 *
 * Opens on click by default, or on right-click with `context-menu`.
 */
const props = defineProps({
  /** Two-way open state. Omit to let the menu manage itself from its trigger. */
  modelValue: {
    type: Boolean,
    default: null
  },
  anchor: {
    type: String,
    default: 'bottom left'
  },
  self: {
    type: String,
    default: 'top left'
  },
  /** Extra `[x, y]` displacement in px. */
  offset: {
    type: Array,
    default: () => [0, 0]
  },
  /** Closes as soon as anything inside is clicked. */
  autoClose: {
    type: Boolean,
    default: false
  },
  /** Opens on right-click at the pointer instead of on left-click at the anchor. */
  contextMenu: {
    type: Boolean,
    default: false
  },
  /** Matches the menu's width to the trigger's. */
  fit: {
    type: Boolean,
    default: false
  },
  /** Caps the panel width, so a long option does not stretch the menu across the screen. */
  maxWidth: {
    type: String,
    default: null
  },
  /** Renders the panel dark whatever the app theme, for a menu opened from a dark surface. */
  dark: {
    type: Boolean,
    default: false
  },
  /** Extra classes for the floating panel. */
  contentClass: {
    type: String,
    default: null
  }
})

/*
  `bg-[var(--color-white)]` rather than `bg-white`: see the comment at the top of the template.
*/
const surfaceClass = computed(() =>
  props.dark
    ? 'bg-[var(--color-dark-3)] text-[var(--color-white)]'
    : 'bg-[var(--color-white)] text-[var(--color-black)] dark:bg-dark-3 dark:text-white'
)

const emit = defineEmits(['update:modelValue', 'show', 'hide'])

const shown = ref(false)
const floatEl = ref(null)
const placeholderEl = ref(null)
const floatStyle = ref({ left: '0px', top: '0px' })

let triggerEl = null
/** Set for a context menu, where the anchor is the pointer rather than the trigger element. */
let pointerRect = null

// -> `modelValue` is opt-in: null means uncontrolled, so only mirror it when actually provided
const isControlled = () => props.modelValue !== null

async function reposition() {
  await nextTick()
  if (!floatEl.value || !triggerEl) {
    return
  }

  const rect = pointerRect ?? triggerEl.getBoundingClientRect()
  if (props.fit) {
    floatEl.value.style.minWidth = `${triggerEl.offsetWidth}px`
  }
  // -> Never let a long menu run off the bottom; it scrolls internally instead
  floatEl.value.style.maxHeight = `${window.innerHeight - 32}px`
  if (props.maxWidth) {
    floatEl.value.style.maxWidth = props.maxWidth
  }

  const { left, top } = anchoredPosition(
    rect,
    { width: floatEl.value.offsetWidth, height: floatEl.value.offsetHeight },
    { anchor: props.anchor, self: props.self, offset: props.offset }
  )
  floatStyle.value = { left: `${left}px`, top: `${top}px` }
}

async function show() {
  shown.value = true
  if (isControlled()) {
    emit('update:modelValue', true)
  }
  emit('show')
  await reposition()
}

function hide() {
  if (!shown.value) {
    return
  }
  shown.value = false
  pointerRect = null
  if (isControlled()) {
    emit('update:modelValue', false)
  }
  emit('hide')
}

function toggle() {
  if (shown.value) {
    hide()
  } else {
    show()
  }
}

function onTriggerClick(ev) {
  if (props.contextMenu) {
    return
  }
  ev.stopPropagation()
  toggle()
}

function onTriggerContextMenu(ev) {
  if (!props.contextMenu) {
    return
  }
  ev.preventDefault()
  ev.stopPropagation()
  // -> A zero-size rect at the cursor makes the pointer the anchor point
  pointerRect = { left: ev.clientX, top: ev.clientY, width: 0, height: 0 }
  show()
}

function onContentClick() {
  if (props.autoClose) {
    hide()
  }
}

function onKeydown(ev) {
  if (ev.key === 'Escape' && shown.value) {
    ev.stopPropagation()
    hide()
  }
}

watch(
  () => props.modelValue,
  (v) => {
    if (v === null || v === shown.value) {
      return
    }
    if (v) {
      show()
    } else {
      hide()
    }
  }
)

onMounted(() => {
  /*
    Climb to the real control rather than stopping at the immediate parent. WBtn wraps its slot in
    an inner <span> (so the label can be hidden while loading), so the naive parent would be that
    span -- and clicking the button's padding, which is outside it, would do nothing.
  */
  const host = placeholderEl.value?.parentElement ?? null
  triggerEl = host?.closest('button, a, .w-btn, .w-item') ?? host
  if (!triggerEl) {
    return
  }
  /*
    Only bind the trigger when uncontrolled. With `v-model` the parent already toggles the state on
    the same click, and binding here too would toggle twice -- opening and immediately closing.
  */
  if (!isControlled()) {
    triggerEl.addEventListener('click', onTriggerClick)
    triggerEl.addEventListener('contextmenu', onTriggerContextMenu)
  }
  document.addEventListener('keydown', onKeydown, true)
  window.addEventListener('resize', hide)

  if (props.modelValue === true) {
    show()
  }
})

onBeforeUnmount(() => {
  if (triggerEl) {
    triggerEl.removeEventListener('click', onTriggerClick)
    triggerEl.removeEventListener('contextmenu', onTriggerContextMenu)
  }
  document.removeEventListener('keydown', onKeydown, true)
  window.removeEventListener('resize', hide)
})

/*
  `updatePosition` is part of the contract callers rely on: a menu whose content changes height
  (NavEditMenu adds and removes rows) has to be re-anchored, or it drifts off its trigger.
*/
defineExpose({ show, hide, toggle, updatePosition: reposition })
</script>

<style scoped>
.w-menu-enter-active,
.w-menu-leave-active {
  transition:
    opacity 0.12s var(--ease-standard),
    transform 0.12s var(--ease-standard);
}
.w-menu-enter-from,
.w-menu-leave-to {
  opacity: 0;
  transform: scale(0.96);
}

@media (prefers-reduced-motion: reduce) {
  .w-menu-enter-active,
  .w-menu-leave-active {
    transition-duration: 0.01ms;
  }
}
</style>
