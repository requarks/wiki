<template>
  <component
    :is="tagName"
    v-bind="linkAttrs"
    :class="classes"
    :tabindex="isInteractive && !isAnchor ? 0 : undefined"
    :role="isInteractive && !isAnchor ? 'button' : undefined"
    :aria-disabled="isDisabled || undefined"
    @click="onClick"
    @keydown="onKeydown">
    <slot />
  </component>
</template>

<script setup>
import { computed } from 'vue'

/**
 * A row in a `WList`: an optional leading section, a main section, and an optional trailing
 * section, supplied as `WItemSection` children.
 *
 * Simplification: the ripple the previous implementation drew on press is replaced by a hover and
 * active background tint. It reads the same at a glance without the extra DOM and animation
 * bookkeeping a ripple needs.
 */
const props = defineProps({
  /** Gives the row hover/press feedback and makes it keyboard-operable. */
  clickable: {
    type: Boolean,
    default: false
  },
  /** Renders as a `router-link`; implies `clickable`. */
  to: {
    type: [String, Object],
    default: null
  },
  /** Applied when `to` matches the current route. */
  activeClass: {
    type: String,
    default: null
  },
  /** Forces the active styling on a non-link item. */
  active: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  /** Reduced height. */
  dense: {
    type: Boolean,
    default: false
  },
  /** Underlying element when this is not a link. */
  tag: {
    type: String,
    default: 'div'
  }
})

const emit = defineEmits(['click'])

// COMPUTED

const isDisabled = computed(() => props.disabled)

const isInteractive = computed(() => (props.clickable || Boolean(props.to)) && !isDisabled.value)

const isAnchor = computed(() => Boolean(props.to) && !isDisabled.value)

/*
  Whether the row should look clickable.

  Wider than `isInteractive`, because a `tag="label"` row is operable without this component doing
  anything: the browser forwards a click on a <label> to the control inside it, which is how the
  settings rows toggle their switch from anywhere along the row. That is invisible without a
  cursor and a hover tint -- the row looks inert and the affordance goes unnoticed.

  Deliberately NOT folded into `isInteractive`: that one also adds `role="button"` and a tab stop,
  which on a label wrapping a switch would announce a button around a switch and put two stops in
  the tab order for one control.
*/
const showsAffordance = computed(
  () => (isInteractive.value || props.tag === 'label') && !isDisabled.value
)

// -> A disabled link must stop being a link, or the browser will still navigate on click
const tagName = computed(() => (isAnchor.value ? 'router-link' : props.tag))

const linkAttrs = computed(() =>
  isAnchor.value ? { to: props.to, activeClass: props.activeClass ?? undefined } : {}
)

const classes = computed(() => [
  /*
    `text-inherit` because a row with `to` renders an <a>, and with no colour of its own it takes
    the user agent's link colour -- which showed as purple for visited routes on the admin sidebar.

    `items-stretch` (the default, stated for the reader) rather than centring: the sections stretch
    to the row's height and centre their own content, which is what lets a child sized `height:
    100%` -- the status lights beside the nav items -- span the full row.
  */
  'w-item flex flex-nowrap items-stretch px-4 text-inherit no-underline',
  props.dense ? 'min-h-8 py-0.5' : 'min-h-12 py-2',
  /*
    `w-item--clickable`, not Tailwind's `cursor-pointer`: Quasar declares that class UNLAYERED and
    `!important`, which no ordinary rule can override -- so the disabled row below could not take
    its cursor back. The class doubles as the marker WList keys its dark-surface hover off.
  */
  showsAffordance.value
    ? 'w-item--clickable hover:bg-black/8 active:bg-black/14 dark:hover:bg-white/14 dark:active:bg-white/22'
    : '',
  isDisabled.value ? 'pointer-events-none opacity-60' : '',
  props.active && props.activeClass ? props.activeClass : ''
])

// METHODS

function onClick(ev) {
  if (isDisabled.value) {
    ev.preventDefault()
    ev.stopPropagation()
    return
  }
  emit('click', ev)
}

/** Keyboard parity for items that are buttons rather than links. */
function onKeydown(ev) {
  if (!isInteractive.value || isAnchor.value) {
    return
  }
  if (ev.key === 'Enter' || ev.key === ' ') {
    // -> Space would otherwise scroll the page
    ev.preventDefault()
    emit('click', ev)
  }
}
</script>

<style scoped>
.w-item--clickable {
  cursor: pointer;
}

/*
  A row whose control is disabled offers nothing to click, so it must not look clickable -- a
  `tag="label"` row is only interactive because the browser forwards its click to that control,
  and a disabled control ignores it.

  Detected from the DOM with `:has()` rather than a prop, so the row cannot fall out of step with
  the control it wraps: there is nothing at the call site to remember to update.
*/
.w-item--clickable:has(:disabled) {
  cursor: default;
}

@media (hover: hover) {
  .w-item:has(:disabled):hover {
    background-color: transparent;
  }
}
</style>
