<template>
  <div
    class="w-btn-toggle inline-flex flex-nowrap align-middle"
    :class="[
      isDisabled ? 'pointer-events-none opacity-60' : '',
      /*
        A push or depth group rounds and raises its segments itself, so it must not clip them --
        the drop on press moves a segment past the group's box, which `overflow-hidden` would cut
        off, and a depth group's skirt and shadow are drawn outside it to begin with.
      */
      depth ? 'w-btn-toggle--depth' : push ? '' : 'w-btn-toggle--framed overflow-hidden rounded'
    ]"
    :style="depth ? { '--w-depth-on': `var(--color-${toggleColor})` } : undefined"
    role="radiogroup"
    :aria-label="ariaLabel">
    <button
      v-for="(opt, idx) of options"
      :key="idx"
      type="button"
      role="radio"
      :aria-checked="String(opt.value === modelValue)"
      :aria-label="opt.ariaLabel || undefined"
      :disabled="opt.disable || undefined"
      class="w-btn-toggle__segment w-unstyled relative"
      :class="[
        noCaps ? 'normal-case' : 'uppercase',
        opt.disable ? 'cursor-not-allowed' : 'cursor-pointer',
        opt.value !== modelValue && opt.disable ? 'opacity-50' : '',
        depth ? depthClasses(opt) : flatClasses(opt, idx)
      ]"
      :style="segmentStyle(opt)"
      @click="$emit('update:modelValue', opt.value)">
      <!--
        `mr-1` is the gutter between the icon and the label, so it belongs to segments that HAVE a
        label. Applied unconditionally it also padded an icon-only segment on one side, which against
        the segment's symmetric `px-3` left the icon sitting 4px left of centre.
      -->
      <w-icon
        v-if="opt.icon"
        :name="opt.icon"
        class="align-middle"
        :class="opt.label !== undefined ? 'mr-1' : ''"
        :size="depth && opt.label === undefined ? '17px' : undefined" />
      <span v-if="opt.label !== undefined">{{ opt.label }}</span>
      <!--
        Inside the segment, so WTooltip's climb to `closest('button, ...)` lands on THIS segment and
        not on the group -- a tooltip per option is the only kind worth having on a segmented control.
      -->
      <w-tooltip v-if="opt.tooltip">{{ opt.tooltip }}</w-tooltip>
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
  /**
   * `[{ label, value, icon?, ariaLabel?, tooltip?, disable? }]`
   *
   * `ariaLabel` names a segment that has only an icon to go on -- an ascending/descending pair, say.
   * Omit it wherever the label is the name, or it would be read out in place of it.
   *
   * `tooltip` is the same idea for the pointer: a line explaining what the segment does, for a
   * control whose label is an icon or a word too short to say it. It appears on hover and on focus.
   *
   * `disable` takes one segment out of reach while the rest stay usable -- a choice the user may not
   * make. A selected segment that is disabled still reads as selected; it just cannot be picked
   * again once left. Say why somewhere visible: a disabled button shows no tooltip.
   */
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
  /**
   * Keycap segments: each one a raised cap standing on a skirt, over a shadow cast by the whole
   * group, sinking as it is pressed. The selected cap stays sunk part of the way and glows in
   * `toggleColor`. Takes the place of `push`, and draws its own faces, so `color` has no effect.
   */
  depth: {
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

/**
 * Classes of a flat or `push` segment: everything the keycap styling below does for itself.
 */
function flatClasses(opt, idx) {
  const selected = opt.value === props.modelValue
  return [
    'px-3 py-1.5 text-sm font-medium transition-[background-color,color,transform]',
    selected && !props.toggleTextColor ? 'text-white' : '',
    !selected && !opt.disable ? 'hover:brightness-95 dark:hover:brightness-110' : '',
    props.push ? pushClasses(idx) : '',
    /*
      Bevelled seam between segments, so the group reads as one control rather than a row.
      Never on the selected segment: the bevel is meant to catch light on an unlit surface, and
      over a solid fill it just looks like a stray line. The colour change already marks that
      edge, so nothing is lost by leaving it off.
    */
    idx > 0 && !selected ? 'w-btn-toggle__seam' : ''
  ]
}

function depthClasses(opt) {
  return ['w-depth', opt.label === undefined ? 'w-depth--icon' : '']
}

function segmentStyle(opt) {
  // -> A keycap paints its own face, and takes its selected colour from the group
  if (props.depth) {
    const color = opt.value === props.modelValue ? props.toggleTextColor : props.textColor
    return color ? { color: `var(--color-${color})` } : undefined
  }
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
.w-btn-toggle__segment:not(.w-depth)[aria-checked='false'] {
  text-shadow: var(--w-btn-toggle-text-shadow);
  /*
    An unselected segment is a control, not secondary text, so it takes the page foreground rather
    than inheriting whatever the context dims to -- an item's `side` section drops its contents to
    54% black, which left these labels a washed-out grey. A `text-color` prop still wins, since
    that arrives as an inline style.
  */
  color: var(--color-black);
}

:global(body.body--dark .w-btn-toggle__segment:not(.w-depth)[aria-checked='false']),
:global(.w-dark-surface .w-btn-toggle__segment:not(.w-depth)[aria-checked='false']) {
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
    makes it look pressed into the surface.
  */
  --w-btn-toggle-text-shadow: 0 1px 0 rgb(255 255 255 / 0.6);
}

:global(body.body--dark .w-btn-toggle),
:global(.w-dark-surface .w-btn-toggle) {
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
:global(body.body--dark .w-btn-toggle--framed),
:global(.w-dark-surface .w-btn-toggle--framed) {
  border-color: rgb(255 255 255 / 0.15);
}

/*
  Keycaps (`depth`).

  Each segment is a cap: a face lit from above (the radial gradient), a bright top edge, a light
  left edge and a dark right one where it meets its neighbour, and a 3px skirt below it drawn as a
  hard shadow. The group casts the shadow the caps stand in. Pressing sinks a cap the full 3px onto
  its skirt; the selected cap stays sunk 2px, with a 1px skirt left showing.

  The selected cap is the toggle colour, `--w-depth-on`, which the template sets on the group from
  `toggleColor` -- so a site whose primary is not blue gets its own colour, and the darker face,
  skirt, inner edges and glow are mixed from it rather than written out. The mixes reproduce the
  design's shades of its blue (#1976D2): the face's lower half #1566B8, the skirt #0D4A87 on a light
  surface and #08305A on a dark one.

  Declared on the group rather than the segment, since a custom property that names another is
  resolved where it is declared, and `--w-depth-on` exists from the group down.
*/
.w-btn-toggle--depth {
  --w-depth-top1: #f6f7f9;
  --w-depth-top2: #e9ebef;
  --w-depth-skirt: #b3b7be;
  --w-depth-ink: #23262b;
  --w-depth-hi: rgb(255 255 255 / 0.95);
  --w-depth-seam: rgb(24 28 36 / 0.14);
  --w-depth-seam-hi: rgb(255 255 255 / 0.9);
  --w-depth-drop: rgb(24 28 36 / 0.22);
  --w-depth-hover: 1.035;

  --w-depth-on-top2: color-mix(in srgb, var(--w-depth-on) 87%, black);
  --w-depth-on-skirt: color-mix(in srgb, var(--w-depth-on) 64%, black);
  --w-depth-on-edge: color-mix(
    in srgb,
    color-mix(in srgb, var(--w-depth-on) 33%, black) 35%,
    transparent
  );
  --w-depth-on-glow: color-mix(in srgb, var(--w-depth-on) 55%, transparent);

  border-radius: 8px;
  box-shadow:
    0 4px 1px var(--w-depth-drop),
    0 8px 12px -5px var(--w-depth-drop);
}

:global(body.body--dark .w-btn-toggle--depth),
:global(.w-dark-surface .w-btn-toggle--depth) {
  --w-depth-top1: #3a3d44;
  --w-depth-top2: #2b2e33;
  /* -> Lifted from the design's #050607, which read as a hard black band under every cap */
  --w-depth-skirt: #141619;
  --w-depth-ink: #ecedef;
  --w-depth-hi: rgb(255 255 255 / 0.12);
  --w-depth-seam: rgb(0 0 0 / 0.6);
  --w-depth-seam-hi: rgb(255 255 255 / 0.06);
  --w-depth-drop: rgb(0 0 0 / 0.65);
  --w-depth-hover: 1.14;
  --w-depth-on-skirt: color-mix(in srgb, var(--w-depth-on) 42%, black);
}

.w-depth {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  /*
    The design's 40px cap, brought down towards a flat segment's 32px. Padding, radius and icon size
    are the design's scaled by the same 0.9, so the caps keep its proportions rather than reading as
    wide, flat slabs.
  */
  height: 36px;
  padding: 0 15px;
  border-radius: 0;
  white-space: nowrap;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.005em;
  color: var(--w-depth-ink);
  background: radial-gradient(
    130% 100% at 50% 0%,
    var(--w-depth-top1) 0%,
    var(--w-depth-top2) 100%
  );
  box-shadow:
    inset 0 1px 0 var(--w-depth-hi),
    inset 1px 0 0 var(--w-depth-seam-hi),
    inset -1px 0 0 var(--w-depth-seam),
    inset 0 -2px 3px rgb(0 0 0 / 0.05),
    0 3px 0 var(--w-depth-skirt);
  transition:
    transform 0.1s cubic-bezier(0.3, 0.7, 0.4, 1),
    box-shadow 0.1s cubic-bezier(0.3, 0.7, 0.4, 1),
    filter 0.15s;
}

.w-depth--icon {
  padding: 0 12px;
}

/*
  An unselected cap's label sits 1px low. Its face is lit from the top, which makes a label centred
  exactly look as if it rides high. 2px off the top of the box moves the centre down 1px.
*/
.w-depth[aria-checked='false'] {
  padding-top: 2px;
}

.w-depth:first-child {
  border-radius: 8px 0 0 8px;
}

/* -> The last cap has no neighbour to its right, so no dark edge there */
.w-depth:last-child {
  border-radius: 0 8px 8px 0;
  box-shadow:
    inset 0 1px 0 var(--w-depth-hi),
    inset 1px 0 0 var(--w-depth-seam-hi),
    inset 0 -2px 3px rgb(0 0 0 / 0.05),
    0 3px 0 var(--w-depth-skirt);
}

.w-depth:only-child {
  border-radius: 8px;
}

.w-depth:not(:disabled):hover {
  filter: brightness(var(--w-depth-hover));
}

.w-depth:not(:disabled):active {
  transform: translateY(3px);
  box-shadow:
    inset 0 1px 0 var(--w-depth-hi),
    inset 1px 0 0 rgb(0 0 0 / 0.18),
    inset -1px 0 0 rgb(0 0 0 / 0.18),
    inset 0 -1px 2px rgb(0 0 0 / 0.05),
    0 0 0 var(--w-depth-skirt);
}

/*
  Selected, pressed or not: it is already down, so neither hover nor press moves it. The doubled class
  brings this level with the `:hover` and `:active` rules above, and coming after them settles it.
*/
.w-depth.w-depth[aria-checked='true'] {
  --w-depth-top1: var(--w-depth-on);
  --w-depth-top2: var(--w-depth-on-top2);
  --w-depth-skirt: var(--w-depth-on-skirt);
  --w-depth-ink: #fff;
  --w-depth-hi: rgb(255 255 255 / 0.35);
  filter: none;
  transform: translateY(2px);
  box-shadow:
    inset 0 1px 0 var(--w-depth-hi),
    inset 1px 0 0 var(--w-depth-on-edge),
    inset -1px 0 0 var(--w-depth-on-edge),
    inset 0 -2px 3px rgb(0 0 0 / 0.1),
    0 1px 0 var(--w-depth-skirt),
    0 0 22px -5px var(--w-depth-on-glow);
}

.w-depth:focus-visible {
  z-index: 1;
  outline: 2px solid var(--w-depth-on);
  outline-offset: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .w-depth {
    transition-duration: 0.01ms;
  }
}
</style>
