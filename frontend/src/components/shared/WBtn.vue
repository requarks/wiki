<template>
  <component
    :is="tag"
    v-bind="linkAttrs"
    :type="isLink ? undefined : type"
    :disabled="isLink ? undefined : isDisabled || undefined"
    :aria-disabled="isLink && isDisabled ? 'true' : undefined"
    :aria-busy="loading || undefined"
    class="w-btn w-unstyled relative inline-flex flex-nowrap items-center justify-center gap-2 align-middle font-medium no-underline outline-offset-2 transition-[background-color,box-shadow,opacity,transform] select-none focus-visible:outline-2"
    :class="classes"
    :style="styles"
    @click="onClick">
    <!-- Held at full size but invisible while loading, so the button does not resize mid-request -->
    <span v-if="loading" class="absolute inset-0 flex items-center justify-center">
      <w-spinner size="1.2em" />
    </span>
    <span
      class="relative inline-flex flex-nowrap items-center gap-2"
      :class="{ invisible: loading }">
      <w-icon v-if="icon" :name="icon" class="shrink-0" />
      <span v-if="label !== null">{{ label }}</span>
      <slot />
    </span>
  </component>
</template>

<script setup>
import { computed } from 'vue'
import WSpinner from './WSpinner.vue'

/**
 * Button.
 *
 * Variants mirror the four the app uses: raised (default), `flat`, `unelevated` and `push`.
 * Content comes from the `label` prop, the default slot, or both.
 */
const props = defineProps({
  label: {
    type: [String, Number],
    default: null
  },
  /** Icon reference, drawn before the label. See `WIcon`. */
  icon: {
    type: String,
    default: null
  },
  /**
   * Theme or palette color name (`primary`, `negative`, `grey-7`, ...), resolved against the
   * Tailwind color variables. Drives the background for solid variants, the text for flat ones.
   */
  color: {
    type: String,
    default: null
  },
  /** Overrides the foreground color independently of `color`. */
  textColor: {
    type: String,
    default: null
  },
  /** No background or shadow until hovered. */
  flat: {
    type: Boolean,
    default: false
  },
  /** Border and text in `color`, with no fill. */
  outline: {
    type: Boolean,
    default: false
  },
  /** Circular icon-only button. */
  round: {
    type: Boolean,
    default: false
  },
  /** Pill-shaped button. */
  rounded: {
    type: Boolean,
    default: false
  },
  /** Solid background, no shadow. */
  unelevated: {
    type: Boolean,
    default: false
  },
  /** Raised, with a ledge along the bottom edge that collapses when the button is pressed. */
  push: {
    type: Boolean,
    default: false
  },
  /** Adds the Material gloss overlay: a light-to-dark sheen across the button face. */
  glossy: {
    type: Boolean,
    default: false
  },
  /**
   * Named size (`xs`..`xl`) or any CSS length. Drives the button's font-size, which every other
   * metric is expressed in `em` against -- so one value scales padding, min-height and icon alike.
   */
  size: {
    type: String,
    default: null
  },
  /** Reduced padding. */
  dense: {
    type: Boolean,
    default: false
  },
  /**
   * Padding override, as Quasar wrote it: one or two size names or CSS lengths, vertical first
   * (`xs md`, `sm`, `none`).
   */
  padding: {
    type: String,
    default: null
  },
  /** Leaves the label cased as written instead of upper-casing it. */
  noCaps: {
    type: Boolean,
    default: false
  },
  /** Swaps the content for a spinner and blocks clicks. */
  loading: {
    type: Boolean,
    default: false
  },
  disable: {
    type: Boolean,
    default: false
  },
  /** Accepted as an alias of `disable`; both spellings appear in the codebase. */
  disabled: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    default: 'button'
  },
  /** Renders as a `router-link`. */
  to: {
    type: [String, Object],
    default: null
  },
  /** Renders as an `<a>`. */
  href: {
    type: String,
    default: null
  },
  target: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['click'])

/** Quasar's named spacing scale, for the `padding` prop. */
/** Quasar's button size scale, in px. */
const FONT_SIZES = { xs: 8, sm: 10, md: 14, lg: 20, xl: 24 }

const SIZES = {
  none: '0',
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '48px'
}

// COMPUTED

const isDisabled = computed(() => props.disable || props.disabled || props.loading)

const isLink = computed(() => Boolean(props.to || props.href))

const tag = computed(() => {
  if (props.to) {
    return 'router-link'
  }
  if (props.href) {
    return 'a'
  }
  return 'button'
})

const linkAttrs = computed(() => {
  if (props.to) {
    return { to: props.to }
  }
  if (props.href) {
    return {
      href: props.href,
      target: props.target,
      // -> Never let a new tab keep a handle on this window
      rel: props.target === '_blank' ? 'noopener noreferrer' : undefined
    }
  }
  return {}
})

// -> Both flat and outline are unfilled; only the border distinguishes them
const isSolid = computed(() => !props.flat && !props.outline)

/*
  Geometry taken from Quasar's own button variables, so migrated screens keep their exact metrics:
    font-size 14px (text-sm) · line-height 1.715em · padding 4px 16px · dense padding .285em
    min-height 2.572em (2em dense) · round 3em (2.4em dense) with no padding
    border-radius 3px, 28px when `rounded`, 50% when `round`
  Sizes are em-relative so they track the font size instead of being re-derived per variant.
  Padding and min-height live in `styles` below, since they are em values rather than scale steps.
*/
const classes = computed(() => [
  props.size ? 'leading-[1.715em]' : 'text-sm leading-[1.715em]',
  props.noCaps ? 'w-btn--no-caps' : '',
  props.round
    ? 'rounded-full'
    : props.rounded
      ? 'rounded-[28px]'
      : props.push
        ? 'w-push rounded-[7px]'
        : 'rounded-[3px]',
  isSolid.value && !props.unelevated ? 'shadow-card' : '',
  props.outline ? 'border border-current' : '',
  isDisabled.value ? 'pointer-events-none opacity-60' : 'cursor-pointer',
  // -> Flat buttons have no background of their own, so hover tints with the current text color
  isSolid.value ? 'hover:brightness-110' : 'hover:bg-current/10',
  props.glossy ? 'w-glossy' : ''
])

const styles = computed(() => {
  const out = {}

  // -> Set first: the em-based metrics below resolve against it
  if (props.size) {
    out.fontSize = FONT_SIZES[props.size] ? `${FONT_SIZES[props.size]}px` : props.size
  }

  // -> A round button is sized by its min box and never padded; anything else follows the scale
  if (props.round) {
    out.minWidth = props.dense ? '2.4em' : '3em'
    out.minHeight = props.dense ? '2.4em' : '3em'
    out.padding = '0'
  } else {
    out.minHeight = props.dense ? '2em' : '2.572em'
    out.padding = props.dense ? '0.285em' : '4px 16px'
  }

  // -> An explicit `padding` prop overrides the variant default, as it did before
  if (props.padding) {
    const [v, h = v] = props.padding.split(/\s+/)
    out.padding = `${SIZES[v] ?? v} ${SIZES[h] ?? h}`
  }

  if (isSolid.value && props.color) {
    out.backgroundColor = `var(--color-${props.color})`
    // -> Solid buttons default to white text, matching the palette's intended contrast
    out.color = `var(--color-${props.textColor ?? 'white'})`
  } else if (props.color || props.textColor) {
    out.color = `var(--color-${props.textColor ?? props.color})`
  }

  return out
})

// METHODS

function onClick(ev) {
  if (isDisabled.value) {
    ev.preventDefault()
    ev.stopPropagation()
    return
  }
  emit('click', ev)
}
</script>

<style scoped>
/*
  Capitalisation, in CSS rather than as a `uppercase` utility.

  Quasar's normalize declares `button, input, select { text-transform: none }` UNLAYERED, and an
  unlayered rule beats every layered one whatever its specificity -- so the utility lost on the
  <button> form of this component while still winning on the <a> form it takes with `to` or `href`.
  The result was two identical buttons rendering with different capitalisation depending on whether
  they navigated: "New" lowercase beside "MANAGE" on the admin dashboard.

  These are scoped rules, which are also unlayered, so a class beats the element selector normally.
  Phase 5 can go back to the utility.
*/
.w-btn {
  text-transform: uppercase;
}
.w-btn--no-caps {
  text-transform: none;
}

/*
  Every icon in a button, however it got there -- the `icon` prop or the default slot. Sized here
  rather than on the prop icon alone so the two routes agree: AccountMenu draws its avatar fallback
  as slot content, and at the inherited 1em it rendered visibly smaller than the neighbouring
  header buttons that use the prop.

  1.715em is the button's line height, which is what the button this replaces used. A caller can
  still override per icon, since `size` renders as an inline font-size.
*/
.w-btn :deep(.w-icon) {
  font-size: 1.715em;
}
</style>
