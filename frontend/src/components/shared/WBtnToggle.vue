<template>
  <div
    class="w-btn-toggle inline-flex flex-nowrap align-middle"
    :class="[
      isDisabled ? 'pointer-events-none opacity-60' : '',
      /*
        A push group rounds and raises its segments itself, so it must not clip them -- the 2px
        drop on press moves a segment past the group's box, which `overflow-hidden` would cut off.
      */
      push ? '' : 'w-btn-toggle--framed overflow-hidden rounded'
    ]"
    role="radiogroup"
    :aria-label="ariaLabel">
    <button
      v-for="(opt, idx) of options"
      :key="idx"
      type="button"
      role="radio"
      :aria-checked="String(opt.value === modelValue)"
      class="w-btn-toggle__segment w-unstyled relative cursor-pointer px-3 py-1.5 text-sm font-medium transition-[background-color,color,transform]"
      :class="[
        noCaps ? 'normal-case' : 'uppercase',
        opt.value === modelValue && !toggleTextColor ? 'text-white' : '',
        opt.value !== modelValue ? 'hover:brightness-95 dark:hover:brightness-110' : '',
        glossy ? 'w-glossy' : '',
        push ? pushClasses(idx) : '',
        /*
          Bevelled seam between segments, so the group reads as one control rather than a row.
          Never on the selected segment: the bevel is meant to catch light on an unlit surface, and
          over a solid fill it just looks like a stray line. The colour change already marks that
          edge, so nothing is lost by leaving it off.
        */
        idx > 0 && opt.value !== modelValue ? 'w-btn-toggle__seam' : ''
      ]"
      :style="segmentStyle(opt)"
      @click="$emit('update:modelValue', opt.value)">
      <w-icon v-if="opt.icon" :name="opt.icon" class="mr-1 align-middle" />
      <span v-if="opt.label !== undefined">{{ opt.label }}</span>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'

/**
 * Segmented single-choice control.
 *
 * `options` is `[{ label, value, icon? }]`, the same shape the templates already build.
 *
 * The four colour props are kept, because the admin toolbars flip all of them on the theme rather
 * than relying on a `dark:` variant.
 */
const props = defineProps({
  modelValue: {
    type: null,
    default: null
  },
  /** `[{ label, value, icon? }]` */
  options: {
    type: Array,
    default: () => []
  },
  /** Colour of the selected segment. */
  toggleColor: {
    type: String,
    default: 'primary'
  },
  /** Text colour of the selected segment. Defaults to white. */
  toggleTextColor: {
    type: String,
    default: null
  },
  /** Background of the unselected segments. Transparent when omitted. */
  color: {
    type: String,
    default: null
  },
  /** Text colour of the unselected segments. */
  textColor: {
    type: String,
    default: null
  },
  /** Raises each segment, with a ledge along its bottom edge that collapses when pressed. */
  push: {
    type: Boolean,
    default: false
  },
  /** Adds the Material gloss overlay to each segment. */
  glossy: {
    type: Boolean,
    default: false
  },
  /** Leave labels cased as written. */
  noCaps: {
    type: Boolean,
    default: false
  },
  disable: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  ariaLabel: {
    type: String,
    default: null
  }
})

defineEmits(['update:modelValue'])

const isDisabled = computed(() => props.disable || props.disabled)

/**
 * Raised-segment classes.
 *
 * Only the group's outer corners are rounded. Rounding every segment would put a pair of facing
 * curves at each seam, which reads as separate buttons pushed together rather than one control.
 * The ledge follows along, since its overlay inherits the segment's radius.
 */
function pushClasses(idx) {
  return [
    'w-push',
    idx === 0 ? 'rounded-l-[7px]' : '',
    idx === props.options.length - 1 ? 'rounded-r-[7px]' : ''
  ]
}

function segmentStyle(opt) {
  if (opt.value === props.modelValue) {
    return {
      backgroundColor: `var(--color-${props.toggleColor})`,
      color: props.toggleTextColor ? `var(--color-${props.toggleTextColor})` : undefined
    }
  }
  return {
    backgroundColor: props.color ? `var(--color-${props.color})` : undefined,
    color: props.textColor ? `var(--color-${props.textColor})` : undefined
  }
}
</script>

<style scoped>
/*
  The seam between two segments: a dark line with a light one immediately to its right, which is
  what gives the join its engraved look rather than reading as a flat divider.

  Painted as an overlay rather than a border for two reasons. A border would add a pixel of width
  to every segment but the first, shifting their labels out of step with the first one's; and the
  pair has to stay exactly two device pixels under fractional display scaling -- at 150% a 2px
  border pair paints three device rows and splits them unevenly between the two colours, which is
  the same artefact `.w-hairline` exists to avoid. `--w-dpr` comes from helpers/hairline.js.
*/
.w-btn-toggle__segment[aria-checked='false'] {
  text-shadow: var(--w-btn-toggle-text-shadow);
  /*
    An unselected segment is a control, not secondary text, so it takes the page foreground rather
    than inheriting whatever the context dims to -- an item's `side` section drops its contents to
    54% black, which left these labels a washed-out grey. A `text-color` prop still wins, since
    that arrives as an inline style.
  */
  color: var(--color-black);
}

:global(body.body--dark .w-btn-toggle__segment[aria-checked='false']) {
  color: var(--color-white);
}

.w-btn-toggle__seam::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 2px;
  background-image: linear-gradient(
    to right,
    var(--w-seam-dark) 0 50%,
    var(--w-seam-light) 50% 100%
  );
  transform: scaleX(calc(1 / var(--w-dpr, 1)));
  transform-origin: left;
  pointer-events: none;
}

.w-btn-toggle {
  --w-seam-dark: rgb(0 0 0 / 0.12);
  --w-seam-light: rgb(255 255 255 / 0.7);
  /*
    A hard 1px highlight under the label, no blur, so it reads as a cut edge rather than a glow --
    the letterpress effect, where the light catching the lower lip of an engraved character is what
    makes it look pressed into the surface. The glossy gradient darkens towards the bottom, which
    is exactly where this sits, so it also keeps the label legible over the darker half.
  */
  --w-btn-toggle-text-shadow: 0 1px 0 rgb(255 255 255 / 0.6);
}

:global(body.body--dark .w-btn-toggle) {
  /*
    Far dimmer than the light theme's highlight. The same white that reads as a soft sheen against
    a pale surface reads as a lit edge against a dark one, so the bevel leans on its shadow half
    here and only hints at the highlight.
  */
  --w-seam-dark: rgb(0 0 0 / 0.4);
  --w-seam-light: rgb(255 255 255 / 0.06);
  /* Nothing to separate here: the dark theme's labels already sit on a uniformly dark fill */
  --w-btn-toggle-text-shadow: none;
}

.w-btn-toggle--framed {
  border: 1px solid rgb(0 0 0 / 0.12);
}
:global(body.body--dark .w-btn-toggle--framed) {
  border-color: rgb(255 255 255 / 0.15);
}
</style>
