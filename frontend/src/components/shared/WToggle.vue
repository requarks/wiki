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
        class="w-toggle__knob inline-flex items-center justify-center rounded-full transition-transform duration-200"
        :class="[dense ? 'size-4' : 'size-5', knobOffset]">
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
 * read from where the knob sits plus the mark at its centre -- a tick when on, a cross when off,
 * drawn in a muted tone so it reads as engraved into the knob rather than printed on it.
 *
 * A disabled switch drops both its relief and its status colour: no glow, a grey mark, and a flat
 * track. Dimming alone read as "slightly faded" rather than "not available", and a green tick on a
 * control nobody can move says the wrong thing twice over.
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
  --w-toggle-track: #dfe3ea;
  --w-toggle-rim: #ffffff;
  --w-toggle-knob: #fdfdfe;
  --w-toggle-knob-rim: rgb(0 0 0 / 0.06);
  --w-toggle-shadow: rgb(0 0 0 / 0.18);
  --w-toggle-highlight: rgb(255 255 255 / 0.95);
  --w-toggle-cast: rgb(0 0 0 / 0.12);
  --w-toggle-glow: 0.62;
  --w-toggle-mark-disabled: #8a8f98;
}

:global(body.body--dark .w-toggle) {
  --w-toggle-track: #262c38;
  --w-toggle-rim: #39414f;
  --w-toggle-knob: #6b7382;
  --w-toggle-knob-rim: rgb(255 255 255 / 0.1);
  --w-toggle-shadow: rgb(0 0 0 / 0.6);
  --w-toggle-highlight: rgb(255 255 255 / 0.07);
  --w-toggle-cast: rgb(0 0 0 / 0.45);
  /* Held up a little: the same tone has less to carry against a dark channel than a pale one */
  --w-toggle-glow: 0.72;
  --w-toggle-mark-disabled: #aeb4bf;
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
  background-color: var(--color-negative);
  opacity: var(--w-toggle-glow);
  filter: blur(9px);
  transition:
    translate 0.2s var(--ease-standard),
    background-color 0.2s var(--ease-standard);
}

[aria-checked='true'] .w-toggle__glow {
  background-color: var(--color-positive);
}

.w-toggle__track {
  background-color: var(--w-toggle-track);
  box-shadow:
    0 0 0 2px var(--w-toggle-rim),
    inset 2px 2px 5px var(--w-toggle-shadow),
    inset -2px -2px 5px var(--w-toggle-highlight),
    2px 3px 6px var(--w-toggle-cast);
}

.w-toggle__knob {
  background-color: var(--w-toggle-knob);
  box-shadow:
    0 0 0 1px var(--w-toggle-knob-rim),
    2px 2px 4px var(--w-toggle-shadow),
    -2px -2px 4px var(--w-toggle-highlight);
}

/*
  The mark takes the theme's own positive/negative tones rather than literal green and red. Those
  two are re-mapped at runtime for colour-vision deficiency (see stores/user.js), which is exactly
  the case where a green/red pair would otherwise stop distinguishing anything -- and they follow
  a site's palette for free.

  It stays a confirmation, not the signal: the knob's position is what announces the state, which
  is what keeps this readable when the two tones are indistinguishable to the viewer.
*/
.w-toggle__mark {
  color: var(--color-negative);
  transition: color 0.2s var(--ease-standard);
}

[aria-checked='true'] .w-toggle__mark {
  color: var(--color-positive);
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

@media (prefers-reduced-motion: reduce) {
  .w-toggle__knob,
  .w-toggle__mark,
  .w-toggle__glow {
    transition-duration: 0.01ms;
  }
}
</style>
