<template>
  <!-- sized via `size` (inline style): a font-size CLASS is defeated by Quasar's unlayered `.q-icon { font-size: inherit }` -->
  <button
    type="button"
    role="checkbox"
    :aria-checked="String(isOn)"
    :aria-label="label ? undefined : ariaLabel"
    :disabled="isDisabled"
    class="w-checkbox w-unstyled inline-flex flex-nowrap items-center gap-2 rounded outline-offset-2 focus-visible:outline-2"
    :class="isDisabled ? 'w-checkbox--disabled pointer-events-none opacity-60' : 'cursor-pointer'"
    @click="toggle">
    <!--
      A recessed well rather than an outlined square, matching the switch's track: the box reads as
      cut into the surface, and ticking it fills that well rather than painting a flat block. The
      rim and the shadows come from the style block; `size-5` and the radius stay here because they
      are metrics rather than relief.
    -->
    <span
      class="w-checkbox__box inline-flex size-5 shrink-0 items-center justify-center rounded-sm transition-colors"
      :class="isOn ? 'w-checkbox__box--on text-white' : ''"
      :style="isOn ? { backgroundColor: `var(--color-${color})` } : undefined">
      <w-icon v-if="isOn" name="mdi:check" size="0.9em" />
    </span>
    <!--
      Same treatment as the switch's label, down to the optical centring: `text-caption` rather than
      `text-body2`, and no colour of its own so it takes the surface's, as the switch's does. The two
      controls answer the same kind of question, so their labels should not be two different sizes.

      `pt-px` is the compensation WToggle and WInput both make -- Roboto's ascent exceeds its descent,
      so a line box centred by geometry sits above the middle of the control beside it.
    -->
    <span v-if="label" class="pt-px text-caption">{{ label }}</span>
  </button>
</template>

<script setup>
import { computed } from 'vue'

/**
 * Checkbox. Binds either a boolean, or a value within an array of selections via `val`.
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
  /** Required when there is no `label`. */
  ariaLabel: {
    type: String,
    default: null
  },
  color: {
    type: String,
    default: 'primary'
  },
  disable: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  },
  /** The value this box contributes when `modelValue` is an array. */
  val: {
    type: null,
    default: undefined
  }
})

const emit = defineEmits(['update:modelValue'])

const isArrayModel = computed(() => Array.isArray(props.modelValue))
const isOn = computed(() =>
  isArrayModel.value ? props.modelValue.includes(props.val) : props.modelValue === true
)
const isDisabled = computed(() => props.disable || props.disabled)

function toggle() {
  if (isArrayModel.value) {
    emit(
      'update:modelValue',
      isOn.value
        ? props.modelValue.filter((v) => v !== props.val)
        : [...props.modelValue, props.val]
    )
  } else {
    emit('update:modelValue', !isOn.value)
  }
}
</script>

<style scoped>
/*
  Same soft relief as WToggle, and deliberately the same three devices, so a checkbox and a switch
  sitting in one form look lit from the same place:

  - a rim around the box, giving it an edge to catch the light instead of fading into the page;
  - paired inset shadows, dark from the top left and light from the bottom right, which is what makes
    it read as a well cut into the surface rather than a square drawn on it;
  - a soft cast shadow below, lifting the control off the page.

  Values are variables for the same reason they are there: a dark surface needs a faint highlight
  rather than a strong one, or the relief turns to glare, and its rim has to be lighter than the well
  where on a light surface it is white. Kept as its own set rather than shared with the switch --
  a 20px square well needs shallower shadows than a 48px channel.
*/
.w-checkbox {
  /*
    Deeper than the switch's values, not shallower, which is the opposite of what the size suggests.
    A 20px box only shows a couple of pixels of gradient either side of centre, so at the switch's
    strength the recess disappeared at 1:1 and only read when magnified. Compared against three
    stronger settings side by side at real size before landing here.
  */
  --w-checkbox-well: #d5dbe4;
  --w-checkbox-rim: #ffffff;
  --w-checkbox-shadow: rgb(0 0 0 / 0.38);
  --w-checkbox-highlight: rgb(255 255 255 / 1);
  --w-checkbox-cast: rgb(0 0 0 / 0.2);
  /* On the filled state the relief has to work over a saturated colour, not a pale grey */
  --w-checkbox-fill-shadow: rgb(0 0 0 / 0.32);
  --w-checkbox-fill-highlight: rgb(255 255 255 / 0.34);
  /* Offsets and blur, kept in one place because the three box-shadows below must agree on them */
  --w-checkbox-relief-offset: 2.5px;
  --w-checkbox-relief-blur: 5px;
}

:global(body.body--dark .w-checkbox) {
  --w-checkbox-well: #20252e;
  --w-checkbox-rim: #39414f;
  --w-checkbox-shadow: rgb(0 0 0 / 0.7);
  /* -> Carries most of the relief here: a darker shadow on an already-dark well only muddies it */
  --w-checkbox-highlight: rgb(255 255 255 / 0.11);
  --w-checkbox-cast: rgb(0 0 0 / 0.5);
  --w-checkbox-fill-shadow: rgb(0 0 0 / 0.5);
  --w-checkbox-fill-highlight: rgb(255 255 255 / 0.26);
}

.w-checkbox__box {
  background-color: var(--w-checkbox-well);
  box-shadow:
    0 0 0 2px var(--w-checkbox-rim),
    inset var(--w-checkbox-relief-offset) var(--w-checkbox-relief-offset)
      var(--w-checkbox-relief-blur) var(--w-checkbox-shadow),
    inset calc(-1 * var(--w-checkbox-relief-offset)) calc(-1 * var(--w-checkbox-relief-offset))
      var(--w-checkbox-relief-blur) var(--w-checkbox-highlight),
    1px 3px 6px var(--w-checkbox-cast);
}

/*
  Ticked: the well keeps its shape and gains a colour, so the tick reads as sitting IN the box. The
  inset pair is restated at the heavier fill values -- the pale-grey ones disappear against a
  saturated background -- while the rim and the cast shadow carry over unchanged.
*/
.w-checkbox__box--on {
  box-shadow:
    0 0 0 2px var(--w-checkbox-rim),
    inset var(--w-checkbox-relief-offset) var(--w-checkbox-relief-offset)
      var(--w-checkbox-relief-blur) var(--w-checkbox-fill-shadow),
    inset calc(-1 * var(--w-checkbox-relief-offset)) calc(-1 * var(--w-checkbox-relief-offset))
      var(--w-checkbox-relief-blur) var(--w-checkbox-fill-highlight),
    1px 3px 6px var(--w-checkbox-cast);
}

/*
  Disabled: flat, as the switch goes flat. The relief is what makes the control read as operable, so
  it goes rather than merely dimming -- the wrapper's own opacity handles the fading.
*/
.w-checkbox--disabled .w-checkbox__box {
  box-shadow:
    0 0 0 2px var(--w-checkbox-rim),
    inset 1px 1px 2px var(--w-checkbox-shadow);
}
</style>
