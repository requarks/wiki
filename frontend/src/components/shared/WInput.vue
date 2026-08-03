<template>
  <!--
    `max-w-full`: the field is often a flex item in a fixed-width track -- the admin rows put one
    in a `flex: 0 0 120px` section. `align-items: stretch` only ever GROWS an item to fill its
    container; it will not shrink one whose content is wider, so a text input at its natural width
    pushed the field past the section and out of the card. The cap does the shrinking, and stretch
    still handles the growing.
  -->
  <div class="w-input max-w-full min-w-0">
    <!-- -> Only the non-outlined variant still labels from above; see `hasFloatingLabel` -->
    <label
      v-if="label && !hasFloatingLabel"
      :for="inputId"
      class="mb-1 block text-caption text-black/60 dark:text-white/70">
      {{ label }}
      <span v-if="required" class="text-negative pr-1" aria-hidden="true">&nbsp;*</span>
    </label>

    <div
      @pointerenter="isHovered = true"
      @pointerleave="isHovered = false"
      class="w-input-control flex flex-nowrap items-center gap-2 rounded"
      :class="controlClasses"
      :style="controlStyle">
      <!--
        The outline, as a fieldset whose legend cuts the notch the floated label sits in.

        A fieldset is the only element that interrupts its own top border for a child, which is what
        makes a real gap rather than a patch: the label needs no background of its own, so it works
        over a white card, a grey `alt-card` section or a dark surface alike. The legend widens from
        nothing to the label's width, and that transition IS the notch opening.

        `aria-hidden`, and the accessible name stays on the real <label> below.
      -->
      <fieldset
        v-if="hasFloatingLabel"
        aria-hidden="true"
        class="w-input-outline"
        :style="outlineStyle">
        <legend :class="isFloating ? 'w-input-outline-notch--open' : ''">
          <span
            >{{ label
            }}<span v-if="required" class="text-negative pr-1" aria-hidden="true"
              >&nbsp;*</span
            ></span
          >
        </legend>
      </fieldset>

      <label
        v-if="hasFloatingLabel"
        :for="inputId"
        class="w-input-float"
        :class="[isFloating ? 'w-input-float--up' : '', floatColorClass]">
        {{ label }}
        <span v-if="required" class="text-negative pr-1" aria-hidden="true">&nbsp;*</span>
      </label>

      <slot name="prepend" />

      <!--
        Static text pinned in front of the value, e.g. the leading "/" on a path filter. Marked
        aria-hidden and paired with a `pt-0.5` so it sits on the same optical baseline as the input:
        it is decoration around the field, not part of what has been typed.
      -->
      <span
        v-if="prefix"
        aria-hidden="true"
        class="shrink-0 pt-0.5 text-black/54 select-none dark:text-white/60">
        {{ prefix }}
      </span>

      <component
        :is="type === 'textarea' ? 'textarea' : 'input'"
        :id="inputId"
        ref="inputEl"
        :type="type === 'textarea' ? undefined : effectiveType"
        :value="modelValue"
        :placeholder="placeholder"
        :readonly="readonly"
        :disabled="disable || disabled"
        :autocomplete="autocomplete"
        :rows="type === 'textarea' ? rows : undefined"
        :aria-invalid="hasError || undefined"
        :aria-required="required || undefined"
        :aria-describedby="describedBy"
        class="w-unstyled min-w-0 flex-1 bg-transparent pt-0.5 outline-none placeholder:text-black/40 dark:placeholder:text-white/40"
        :class="monospaced ? 'font-mono text-[13px] leading-[1.4] font-semibold' : ''"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keyup.enter="$emit('keyup:enter', $event)" />

      <!--
        The mirror of the prefix above, and placed before the trailing controls rather than after
        them: it belongs to the value -- the closing `/` of a regex, a unit after a number -- so it
        has to sit against the text, not beyond the clear cross.
      -->
      <span
        v-if="suffix"
        aria-hidden="true"
        class="shrink-0 pt-0.5 text-black/54 select-none dark:text-white/60">
        {{ suffix }}
      </span>

      <!--
        `mr-1` on the button rather than more padding on the control: the padding is what every
        trailing control shares -- the clear cross, an `append` slot -- and this is about the eye,
        which reads cramped against the field's edge at the row's own 8px.
      -->
      <button
        v-if="revealable && type === 'password'"
        type="button"
        class="w-unstyled mr-1 shrink-0 cursor-pointer opacity-60 hover:opacity-100"
        :aria-label="isRevealed ? hideLabel : revealLabel"
        :aria-pressed="String(isRevealed)"
        @click="isRevealed = !isRevealed">
        <!-- -> A size of its own rather than the control's 1em: at the field's 14px the eye came out
                smaller than the text it sits beside, which is not much of a target to aim at -->
        <w-icon :name="isRevealed ? 'mdi:eye-off' : 'mdi:eye'" size="xs" />
      </button>

      <button
        v-if="clearable && String(modelValue ?? '').length > 0"
        type="button"
        class="w-unstyled shrink-0 cursor-pointer opacity-60 hover:opacity-100"
        :aria-label="clearLabel"
        @click="clear">
        <w-icon name="mdi:close" />
      </button>

      <slot name="append" />
    </div>

    <!--
      The line under the control that error and hint text occupy.

      Held open only when something could actually go there -- a hint, a validating rule, or a
      message showing right now. Reserving it unconditionally cost every plain field 24px of dead
      height, and because that height sits inside the field, it pushed the visible control above
      the centre of whatever row held it: measured at 8px above / 28px below in an item row.

      Where a rule exists the space stays reserved even with nothing to say, so the form does not
      shift the moment a message appears -- which is the reason to hold it at all.
    -->
    <div
      v-if="showsBottom"
      :id="`${inputId}-desc`"
      class="min-h-5 px-1 pt-1 text-caption"
      :class="hasError ? 'text-negative' : 'text-black/54 dark:text-white/60'">
      {{ errorMessage || hint }}
    </div>
  </div>
</template>

<script setup>
import { computed, inject, ref, useId, useSlots, watch } from 'vue'

/**
 * Text input.
 *
 * Validation follows the `rules` convention already in the codebase: an array of functions taking
 * the value and returning `true` when valid, or a message string when not.
 */
const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  label: {
    type: String,
    default: null
  },
  type: {
    type: String,
    default: 'text'
  },
  /** Static text shown before the value. */
  prefix: {
    type: String,
    default: null
  },
  /** Static text shown after the value, e.g. the closing `/` of a pattern or a unit. */
  suffix: {
    type: String,
    default: null
  },
  placeholder: {
    type: String,
    default: null
  },
  /**
   * Marks the field as one that has to be filled in.
   *
   * Draws a red asterisk beside the label and tells assistive technology the same thing through
   * `aria-required`; it does not validate anything or set the native `required` attribute, since the
   * form around it owns when and how it complains.
   */
  required: {
    type: Boolean,
    default: false
  },
  /** Helper text below the control, replaced by the error message when invalid. */
  hint: {
    type: String,
    default: null
  },
  /** Bordered style. Retained as a prop because the markup sets it explicitly nearly everywhere. */
  outlined: {
    type: Boolean,
    default: false
  },
  /**
   * Drop the field's own surface and let whatever is behind it show through.
   *
   * For a field on a surface that is not flat: a translucent (acrylic) menu, where the field's white
   * would sit as an opaque slab on a panel meant to be see-through — and where the floating label,
   * riding the top border, would have that slab on one side of it and the blur on the other.
   *
   * Only the fill goes. The border, the focus ring and the label's notch are untouched, so the field is
   * still obviously a field.
   */
  transparent: {
    type: Boolean,
    default: false
  },
  dense: {
    type: Boolean,
    default: false
  },
  readonly: {
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
  autocomplete: {
    type: String,
    default: null
  },
  /** Rows for `type="textarea"`. */
  rows: {
    type: [String, Number],
    default: 3
  },
  /** Monospaced content, e.g. code or keys. */
  monospaced: {
    type: Boolean,
    default: false
  },
  /**
   * Adds a show/hide toggle to a `type="password"` field. Without it, a value the user never typed
   * -- one filled in by a generate button, say -- can be neither read nor re-entered anywhere.
   */
  revealable: {
    type: Boolean,
    default: false
  },
  /** Accessible name for the reveal toggle. */
  revealLabel: {
    type: String,
    default: 'Show password'
  },
  /** Accessible name for the reveal toggle once the value is visible. */
  hideLabel: {
    type: String,
    default: 'Hide password'
  },
  /** Shows a clear button while the field has a value. */
  clearable: {
    type: Boolean,
    default: false
  },
  /** Accessible name for the clear button. */
  clearLabel: {
    type: String,
    default: 'Clear'
  },
  /** Drops the reserved line beneath the control. */
  hideBottomSpace: {
    type: Boolean,
    default: false
  },
  /** `Array<(value) => true | string>` */
  rules: {
    type: Array,
    default: () => []
  },
  /**
   * When to run `rules`:
   *   false        validate on every change
   *   true         stay silent until the first blur, then validate on every change
   *   'ondemand'   never validate automatically -- only when `validate()` is called, which is
   *                what the enclosing WForm does on submit
   */
  lazyRules: {
    type: [Boolean, String],
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'keyup:enter', 'focus', 'blur'])

const slots = useSlots()

const inputEl = ref(null)
const inputId = useId()
const errorMessage = ref(null)
const hasBlurred = ref(false)
const hasFocus = ref(false)
/** Pointer-over, for the ring: the ring is an inline style, so CSS `:hover` cannot reach it. */
const isHovered = ref(false)
const isRevealed = ref(false)

// COMPUTED

const hasError = computed(() => Boolean(errorMessage.value))

/** A revealed password field renders as plain text; every other type is passed through unchanged. */
const effectiveType = computed(() =>
  props.type === 'password' && props.revealable && isRevealed.value ? 'text' : props.type
)

/*
  `pt-0.5` on the control is optical centring, not padding.

  Roboto's ascent exceeds its descent, so a line box centred by geometry renders its glyphs above
  the optical centre -- measured at 2px high in both field sizes, with the input's own box exactly
  centred. Two pixels of top padding is the smallest nudge that balances it (one pixel is absorbed
  by the flex centring), and the box does not grow, since the control's min-height already leaves
  room.
*/
/** See the note in the template: held open only when a message could occupy it. */
const showsBottom = computed(
  () =>
    Boolean(errorMessage.value) ||
    (!props.hideBottomSpace && (props.hint || props.rules.length > 0))
)

const describedBy = computed(() => (showsBottom.value ? `${inputId}-desc` : undefined))

/*
  A label on an outlined field rides the outline, Material-style, instead of sitting above it: at rest
  it stands in the middle of the field, and on focus or once there is a value it rises into the top
  border. The non-outlined (filled) variant keeps its label above, since there is no outline to rise
  into -- only three call sites in the app are labelled and not outlined.
*/
const hasFloatingLabel = computed(() => Boolean(props.label) && props.outlined)

const hasValue = computed(() => String(props.modelValue ?? '').length > 0)

/*
  Floated whenever the resting position is unavailable or would collide.

  A leading icon or prefix keeps it floated permanently: the resting label occupies the same place as
  the field's text, which begins after those, so the two would overlap. MUI resolves this the same
  way -- it asks the caller to pin the label up whenever there is a start adornment.

  A placeholder likewise: it renders in the resting position the moment the field is empty.
*/
const hasLeadingAdornment = computed(() => Boolean(slots.prepend || props.prefix))

const isFloating = computed(
  () => hasFocus.value || hasValue.value || Boolean(props.placeholder) || hasLeadingAdornment.value
)

const floatColorClass = computed(() => {
  if (hasError.value) {
    return 'text-negative'
  }
  // -> `primary` is picked to read on white; on a dark field it needs the lightened mix
  return hasFocus.value
    ? 'text-primary dark:text-primary-light'
    : 'text-black/60 dark:text-white/70'
})

const controlClasses = computed(() => [
  props.dense ? 'w-input-control--dense min-h-9 px-2 py-1' : 'min-h-11 px-3 py-2',
  /*
    An outlined field carries its own surface rather than borrowing whatever it sits on: white in
    light mode, a darker well in dark mode. Transparent read fine on a white card and wrong
    everywhere else -- a grey `alt-card` section, the admin page background, the profile card -- where
    the field dissolved into its surroundings.

    The dark value is translucent black rather than a fixed tone so it holds up on each of those
    surfaces; the light one can be flat white because that IS the surface a field should present.

    `transparent` opts out, for the surfaces where that reasoning inverts -- see the prop.
  */
  props.transparent
    ? props.outlined
      ? ''
      : 'rounded-b-none'
    : props.outlined
      ? 'bg-white dark:bg-black/20'
      : 'rounded-b-none bg-black/4 dark:bg-white/6',
  props.disable || props.disabled ? 'pointer-events-none opacity-60' : '',
  /*
    `relative` for the outline and the label. The margin is the room the floated label needs above the
    control, and it is matched below so the field's box stays symmetric about the control -- otherwise
    a top margin alone drops the control below the centre of whatever row it sits in, out of line with
    a leading icon beside it.

    Skipped underneath when a message line follows, since that already occupies the space and the gap
    would only push the message away from the field it belongs to.
  */
  hasFloatingLabel.value ? (showsBottom.value ? 'relative mt-2' : 'relative my-2') : ''
])

/**
 * The field frame, drawn as an inset ring rather than a border.
 *
 * Ports what Quasar did with two stacked pseudo-elements: a 1px resting frame and a 2px focus
 * frame occupying the same rectangle, so the thicker one covers the thinner one. Insets do not
 * take part in layout, so thickening on focus cannot nudge the content -- which a real border
 * would. `--w-input-ring` carries the resting colour so dark mode can swap it in CSS.
 *
 * Built as an inline style on purpose: the colour depends on three pieces of state, and an
 * arbitrary Tailwind class would be one more thing that has to survive the scanner and the
 * Quasar cascade.
 */
const frameColor = computed(() =>
  hasError.value
    ? 'var(--color-negative)'
    : hasFocus.value
      ? 'var(--color-primary)'
      : isHovered.value && !props.disable && !props.disabled && !props.readonly
        ? 'var(--w-input-ring-hover)'
        : 'var(--w-input-ring)'
)

// -> Error and focus both read as "active", and get the heavier 2px frame
const frameWidth = computed(() => (hasError.value || hasFocus.value ? 2 : 1))

const controlStyle = computed(() => {
  // -> A floating label needs a frame that can be interrupted, which the fieldset draws instead
  if (hasFloatingLabel.value) {
    return undefined
  }
  return {
    boxShadow: props.outlined
      ? `inset 0 0 0 ${frameWidth.value}px ${frameColor.value}`
      : `inset 0 -${frameWidth.value}px 0 0 ${frameColor.value}`
  }
})

const outlineStyle = computed(() => ({
  borderColor: frameColor.value,
  borderWidth: `${frameWidth.value}px`
}))

// METHODS

/**
 * Runs `rules` and records the first failure.
 * @returns {boolean} Whether the value is valid.
 */
function validate() {
  for (const rule of props.rules) {
    const result = rule(props.modelValue)
    if (result !== true) {
      errorMessage.value = typeof result === 'string' ? result : 'Invalid'
      return false
    }
  }
  errorMessage.value = null
  return true
}

/**
 * Emits an empty string rather than null: `modelValue` is typed as string|number here, and callers
 * bind it straight into request payloads where a null would change the meaning.
 */
function clear() {
  emit('update:modelValue', '')
}

function onInput(ev) {
  emit('update:modelValue', ev.target.value)
}

function onFocus(ev) {
  hasFocus.value = true
  emit('focus', ev)
}

function onBlur(ev) {
  hasFocus.value = false
  emit('blur', ev)
  hasBlurred.value = true
  if (props.rules.length && props.lazyRules !== 'ondemand') {
    validate()
  }
}

// -> With lazyRules the field stays silent until first blur, then re-validates on every keystroke
watch(
  () => props.modelValue,
  () => {
    if (!props.rules.length || props.lazyRules === 'ondemand') {
      return
    }
    if (props.lazyRules && !hasBlurred.value) {
      return
    }
    validate()
  }
)

/*
  Join the enclosing WForm, if there is one, so submitting validates this field too. Optional by
  design -- most inputs in the codebase stand alone rather than inside a form.
*/
const registerWithForm = inject('wFormRegister', null)
registerWithForm?.({ validate })

defineExpose({
  validate,
  focus: () => inputEl.value?.focus(),
  /**
   * Show the value of a `revealable` password field, as if the eye had been clicked.
   *
   * For a caller that fills the field in itself: a generated password the user never typed is worth
   * nothing hidden behind dots, and having to click the eye afterwards is a step with no purpose.
   * Hiding it again is left to the user, which is why there is no matching `conceal()`.
   */
  reveal: () => {
    isRevealed.value = true
  },
  hasError
})
</script>
