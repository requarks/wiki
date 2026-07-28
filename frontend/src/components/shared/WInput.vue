<template>
  <!--
    `max-w-full`: the field is often a flex item in a fixed-width track -- the admin rows put one
    in a `flex: 0 0 120px` section. `align-items: stretch` only ever GROWS an item to fill its
    container; it will not shrink one whose content is wider, so a text input at its natural width
    pushed the field past the section and out of the card. The cap does the shrinking, and stretch
    still handles the growing.
  -->
  <div class="w-input max-w-full min-w-0">
    <label
      v-if="label"
      :for="inputId"
      class="mb-1 block text-caption text-black/60 dark:text-white/70">
      {{ label }}
    </label>

    <div
      @pointerenter="isHovered = true"
      @pointerleave="isHovered = false"
      class="w-input-control flex flex-nowrap items-center gap-2 rounded"
      :class="controlClasses"
      :style="controlStyle">
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
        :aria-describedby="describedBy"
        class="w-unstyled min-w-0 flex-1 bg-transparent pt-0.5 outline-none placeholder:text-black/40 dark:placeholder:text-white/40"
        :class="monospaced ? 'font-mono text-[13px] leading-[1.4] font-semibold' : ''"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keyup.enter="$emit('keyup:enter', $event)" />

      <button
        v-if="revealable && type === 'password'"
        type="button"
        class="w-unstyled shrink-0 cursor-pointer opacity-60 hover:opacity-100"
        :aria-label="isRevealed ? hideLabel : revealLabel"
        :aria-pressed="String(isRevealed)"
        @click="isRevealed = !isRevealed">
        <w-icon :name="isRevealed ? 'mdi:eye-off' : 'mdi:eye'" />
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
import { computed, inject, ref, useId, watch } from 'vue'

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
  placeholder: {
    type: String,
    default: null
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

const controlClasses = computed(() => [
  props.dense ? 'min-h-9 px-2 py-1' : 'min-h-11 px-3 py-2',
  props.outlined ? 'bg-transparent' : 'rounded-b-none bg-black/4 dark:bg-white/6',
  props.disable || props.disabled ? 'pointer-events-none opacity-60' : ''
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
const controlStyle = computed(() => {
  const color = hasError.value
    ? 'var(--color-negative)'
    : hasFocus.value
      ? 'var(--color-primary)'
      : isHovered.value && !props.disable && !props.disabled && !props.readonly
        ? 'var(--w-input-ring-hover)'
        : 'var(--w-input-ring)'
  // -> Error and focus both read as "active", and get the heavier 2px frame
  const width = hasError.value || hasFocus.value ? 2 : 1
  return {
    boxShadow: props.outlined
      ? `inset 0 0 0 ${width}px ${color}`
      : `inset 0 -${width}px 0 0 ${color}`
  }
})

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
  hasError
})
</script>
