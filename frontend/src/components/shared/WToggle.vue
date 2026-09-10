<template>
  <button
    type="button"
    role="switch"
    :aria-checked="String(isOn)"
    :aria-label="label ? undefined : ariaLabel"
    :disabled="isDisabled"
    class="w-toggle w-unstyled inline-flex flex-nowrap items-center gap-2 rounded outline-offset-2 focus-visible:outline-2"
    :class="isDisabled ? 'w-toggle--disabled pointer-events-none' : 'cursor-pointer'"
    @click="toggle">
    <span
      class="w-toggle__track relative inline-flex shrink-0 items-center rounded-full"
      :class="dense ? 'h-5 w-10' : 'h-6 w-12'">
      <!--
        The glow is clipped by its own layer rather than by the track, so the knob (a sibling) keeps
        its shadows intact -- clipping the track would cut the relief off at its edge.
      -->
      <span class="w-toggle__glow-clip">
        <span
          class="w-toggle__glow absolute top-1/2 -translate-y-1/2 scale-125 rounded-full"
          :class="[dense ? 'size-4' : 'size-5', knobOffset]" />
      </span>
      <span
        class="w-toggle__knob relative inline-flex items-center justify-center rounded-full"
        :class="[dense ? 'size-4' : 'size-5', knobOffset]">
        <!--
          A second copy of the same glyph, one pixel down-right and under the real one, so the mark
          keeps an edge against the knob it sits on. Same light source as the rest of the relief.
        -->
        <w-icon
          class="w-toggle__mark-shadow"
          :name="isOn ? 'mdi:check' : 'mdi:close'"
          :size="dense ? '11px' : '13px'" />
        <w-icon
          class="w-toggle__mark"
          :name="isOn ? 'mdi:check' : 'mdi:close'"
          :size="dense ? '11px' : '13px'" />
      </span>
    </span>
    <span v-if="label" class="w-toggle__label pt-px text-caption">{{ label }}</span>
  </button>
</template>

<script setup>
import { computed } from 'vue'

/**
 * On/off switch.
 *
 * The track is a recessed channel and the knob sits proud of it, lit from the top left; state is
 * read from where the knob sits plus the status tone -- a tick when on, a cross when off.
 *
 * WHICH part wears that tone depends on the theme, and it is the one thing about this control that
 * is not just a change of value between the two. On a dark surface the pin itself is the coloured
 * element, with a white mark on it, which is what gives the switch something bright to read at a
 * glance. On a light one the pin stays near-white and the MARK carries the colour, because a
 * saturated pin on a pale page shouts far louder than the same pin does against a dark one.
 *
 * A disabled switch drops both its relief and its status colour: no glow, a neutral pin, a grey
 * mark, and a flat track. Dimming alone read as "slightly faded" rather than "not available", and a
 * green mark on a control nobody can move says the wrong thing twice over.
 *
 * The label's `pt-px` is optical centring, the same compensation WInput makes: Roboto's ascent
 * exceeds its descent, so a line box centred by geometry renders its glyphs above the middle of
 * the track beside it.
 *
 * There is no `color` prop and no per-call-site glyphs: the switch says the same thing everywhere,
 * in one place, rather than each caller picking a tint and a pair of icons. A toggle that needs to
 * signal danger should say so in its label.
 */
const props = defineProps({
  modelValue: {
    type: [Boolean, Array],
    default: false
  },
  label: {
    type: String,
    default: null
  },
  /** Required when there is no `label`, so the control is still announced. */
  ariaLabel: {
    type: String,
    default: null
  },
  dense: {
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
  /**
   * Present only when `modelValue` is an array: the value this toggle contributes to it. Lets a set
   * of toggles bind to one array of selected values.
   */
  val: {
    type: null,
    default: undefined
  }
})

const emit = defineEmits(['update:modelValue'])

// COMPUTED

const isArrayModel = computed(() => Array.isArray(props.modelValue))

const isOn = computed(() =>
  isArrayModel.value ? props.modelValue.includes(props.val) : props.modelValue === true
)

const isDisabled = computed(() => props.disable || props.disabled)

/** Shared by the knob and the glow behind it, so the two cannot drift apart. */
const knobOffset = computed(() => {
  if (!isOn.value) {
    return 'translate-x-0.5'
  }
  return props.dense ? 'translate-x-5.5' : 'translate-x-6.5'
})

// METHODS

function toggle() {
  if (isArrayModel.value) {
    const next = isOn.value
      ? props.modelValue.filter((v) => v !== props.val)
      : [...props.modelValue, props.val]
    emit('update:modelValue', next)
  } else {
    emit('update:modelValue', !isOn.value)
  }
}
</script>

<style scoped>
/*
  Soft-relief switch. The effect is a single light source at the top left, expressed three ways:

  - a rim around each surface, so the control has an edge to catch that light rather than fading
    into the page -- this is what gives it its depth, and without it the whole thing reads flat;
  - paired shadows, dark cast down-right and light up-left: inset on the track so it reads as a
    channel cut into the surface, outset on the knob so it reads as sitting on top of one;
  - a soft cast shadow under the track, lifting the control off the page.

  Every value is a variable because the two themes need quite different ones for the same role. On
  a dark surface the highlight must be a faint white rather than a strong one, or the relief turns
  into glare, and the rim has to be *lighter* than the track where on a light surface it is white.
*/
.w-toggle {
  /*
    The status tone, in one place: the glow always takes it, and each theme points either the pin or
    the mark at it further down. It lives on the button rather than on the three elements that draw
    it, so they cannot disagree about which state they are showing.
  */
  --w-toggle-status: var(--color-negative);
  --w-toggle-track: #dfe3ea;
  --w-toggle-rim: #ffffff;
  --w-toggle-knob: #fdfdfe;
  --w-toggle-knob-rim: rgb(0 0 0 / 0.06);
  --w-toggle-shadow: rgb(0 0 0 / 0.18);
  --w-toggle-highlight: rgb(255 255 255 / 0.95);
  --w-toggle-cast: rgb(0 0 0 / 0.12);
  --w-toggle-glow: 0.62;
  --w-toggle-mark: var(--w-toggle-status);
  --w-toggle-mark-disabled: #8a8f98;
  /*
    A pale pin needs no relief under the mark, so the copy is the pin's own tone and draws nothing.
    Keeping it painted rather than hidden is what makes the dark theme a change of colour and not a
    change of markup.
  */
  --w-toggle-mark-shadow: #ffffff;
  /* The pin is neutral here either way, so disabled changes only the mark */
  --w-toggle-knob-disabled: var(--w-toggle-knob);
}

.w-toggle[aria-checked='true'] {
  --w-toggle-status: var(--color-positive);
}

:global(body.body--dark .w-toggle) {
  --w-toggle-track: #262c38;
  --w-toggle-rim: #39414f;
  --w-toggle-knob: var(--w-toggle-status);
  --w-toggle-knob-rim: rgb(255 255 255 / 0.1);
  --w-toggle-shadow: rgb(0 0 0 / 0.6);
  --w-toggle-highlight: rgb(255 255 255 / 0.07);
  --w-toggle-cast: rgb(0 0 0 / 0.45);
  /* Held up a little: the same tone has less to carry against a dark channel than a pale one */
  --w-toggle-glow: 0.72;
  --w-toggle-mark: #ffffff;
  --w-toggle-mark-disabled: #aeb4bf;
  /* White on the positive tone is a weak pairing, so the mark gets an edge to read against */
  --w-toggle-mark-shadow: rgb(0 0 0 / 0.3);
  /* Shed the status colour when the control cannot be moved; this is the pin's old neutral */
  --w-toggle-knob-disabled: #6b7382;
}

.w-toggle__glow-clip {
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  overflow: hidden;
  pointer-events: none;
}

/*
  A soft pool of colour cast into the channel from under the knob. Sitting behind an opaque knob,
  only its spill is visible, so it reads as light coming off the knob rather than as a painted
  patch -- and because it carries the same offset class, it travels with it for free.

  Reach is set by the blur plus `scale-125`, measured at roughly 17px of visible tint beyond the
  knob's edge. Scaling rather than sizing the element up keeps it centred on the knob for nothing:
  a larger box would need its own half-the-difference offset, which is one more thing to keep in
  step with the knob.
*/
.w-toggle__glow {
  background-color: var(--w-toggle-status);
  opacity: var(--w-toggle-glow);
  filter: blur(9px);
  transition:
    translate 0.2s var(--ease-standard),
    background-color 0.2s var(--ease-standard);
}

.w-toggle__track {
  background-color: var(--w-toggle-track);
  box-shadow:
    0 0 0 2px var(--w-toggle-rim),
    inset 2px 2px 5px var(--w-toggle-shadow),
    inset -2px -2px 5px var(--w-toggle-highlight),
    2px 3px 6px var(--w-toggle-cast);
}

/*
  The transition is declared here rather than with Tailwind's `transition-transform`, because in the
  dark theme the pin's colour has to travel with its movement. Same duration and easing as the glow,
  which shares the knob's offset class and so must move in step with it.
*/
.w-toggle__knob {
  background-color: var(--w-toggle-knob);
  box-shadow:
    0 0 0 1px var(--w-toggle-knob-rim),
    2px 2px 4px var(--w-toggle-shadow),
    -2px -2px 4px var(--w-toggle-highlight);
  transition:
    translate 0.2s var(--ease-standard),
    background-color 0.2s var(--ease-standard);
}

/*
  The status tones are the theme's own rather than literal green and red. Those two are re-mapped at
  runtime for colour-vision deficiency (see stores/user.js), which is exactly the case where a
  green/red pair would otherwise stop distinguishing anything -- and they follow a site's palette
  for free.

  The mark stays a confirmation, not the signal: the knob's position is what announces the state,
  which is what keeps this readable when the two tones are indistinguishable to the viewer.
*/
.w-toggle__mark {
  position: relative;
  color: var(--w-toggle-mark);
  transition: color 0.2s var(--ease-standard);
}

/*
  The mark's drop shadow. Both copies are positioned, so painting order is document order and the
  real mark covers this one -- `z-index: -1` would put it behind the knob's own background instead.

  What it draws is the theme's business, and both answers are in the variable blocks above: a pixel
  of dark under a white mark on a coloured pin, or nothing at all on a pale one.
*/
.w-toggle__mark-shadow {
  position: absolute;
  top: 50%;
  left: 50%;
  translate: calc(-50% + 1px) calc(-50% + 1px);
  color: var(--w-toggle-mark-shadow);
}

/*
  Disabled: flat and colourless.

  The relief is what makes the control read as operable, so the knob loses its shadows and the
  track's channel softens to a hint. The status colours go with them.
*/
.w-toggle--disabled {
  opacity: 0.55;
}

.w-toggle--disabled .w-toggle__knob {
  background-color: var(--w-toggle-knob-disabled);
  box-shadow: 0 0 0 1px var(--w-toggle-knob-rim);
}

.w-toggle--disabled .w-toggle__track {
  box-shadow:
    0 0 0 2px var(--w-toggle-rim),
    inset 1px 1px 2px var(--w-toggle-shadow);
}

.w-toggle--disabled .w-toggle__glow {
  display: none;
}

.w-toggle--disabled .w-toggle__mark {
  color: var(--w-toggle-mark-disabled);
}

/*
  A flat control has nothing for a shadow to be cast onto, and the grey mark is what says the switch
  is out of reach -- giving it relief the operable one has would undo that.
*/
.w-toggle--disabled .w-toggle__mark-shadow {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .w-toggle__knob,
  .w-toggle__mark,
  .w-toggle__glow {
    transition-duration: 0.01ms;
  }
}
</style>
