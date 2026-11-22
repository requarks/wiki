<template>
  <!--
    `max-w-full`: the field is often a flex item in a fixed-width track -- the admin rows put one
    in a `flex: 0 0 120px` section. `align-items: stretch` only ever GROWS an item to fill its
    container; it will not shrink one whose content is wider, so a text input at its natural width
    pushed the field past the section and out of the card. The cap does the shrinking, and stretch
    still handles the growing.
  -->
  <div class="w-input w-field max-w-full min-w-0">
    <label v-if="label" :for="inputId" class="w-field-label">
      {{ label }}
      <span v-if="required" class="text-negative pr-1" aria-hidden="true">&nbsp;*</span>
    </label>

    <div class="w-field-well" :class="controlClasses">
      <slot name="prepend" />

      <!--
        Static text pinned in front of the value, e.g. the leading "/" on a path filter. Marked
        aria-hidden and paired with a `pt-0.5` so it sits on the same optical baseline as the input:
        it is decoration around the field, not part of what has been typed.
      -->
      <span v-if="prefix" aria-hidden="true" class="w-field-affix shrink-0 pt-0.5 select-none">
        {{ prefix }}
      </span>

      <component
        :is="type === 'textarea' ? 'textarea' : 'input'"
        :id="inputId"
        ref="inputEl"
        :type="type === 'textarea' ? undefined : effectiveType"
        :value="modelValue"
        :placeholder="placeholder"
        :min="min ?? undefined"
        :max="max ?? undefined"
        :readonly="readonly"
        :disabled="isDisabled"
        v-bind="autofillAttrs"
        :rows="type === 'textarea' ? rows : undefined"
        :aria-invalid="hasError || undefined"
        :aria-required="required || undefined"
        :aria-describedby="describedBy"
        class="w-unstyled w-field-input min-w-0 flex-1 bg-transparent pt-0.5 outline-none"
        :class="[
          monospaced ? 'font-mono text-[13px] leading-[1.4] font-semibold' : '',
          isAutogrow ? 'resize-none overflow-hidden' : ''
        ]"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keyup.enter="$emit('keyup:enter', $event)" />

      <!--
        The mirror of the prefix above, and placed before the trailing controls rather than after
        them: it belongs to the value -- the closing `/` of a regex, a unit after a number -- so it
        has to sit against the text, not beyond the clear cross.
      -->
      <span v-if="suffix" aria-hidden="true" class="w-field-affix shrink-0 pt-0.5 select-none">
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
      class="w-field-help"
      :class="hasError ? 'w-field-help--error' : ''">
      {{ errorMessage || hint }}
    </div>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

/**
 * Text input.
 *
 * A recessed well with its label above it: sunk into the surface, and lit in the site's primary
 * colour -- floor, edge and halo -- while it has focus. The well and its palette are `.w-field-*` in
 * `tailwind.css`, shared with WSelect.
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
   * The native `min` / `max` of the input, for a `number` (or `date`) field — what its stepper and
   * picker stay within. Not a validation, which is still the `rules`' job.
   */
  min: {
    type: [String, Number],
    default: null
  },
  max: {
    type: [String, Number],
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
  /**
   * Drop the well's floor and let whatever is behind it show through.
   *
   * For a field on a surface that is not flat: a translucent (acrylic) menu, where the floor would sit
   * as an opaque slab on a panel meant to be see-through. Only the floor goes. The edges and the focus
   * ring are untouched, so the field is still obviously a field.
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
  /**
   * Keep browsers and password managers out of this field entirely.
   *
   * `autocomplete` alone only talks to the browser, and a field holding somebody ELSE's credential
   * -- an SMTP account, a storage target's key -- is exactly what a password manager offers to fill
   * with the operator's own, and then offers to save over afterwards. Each vendor reads its own
   * opt-out attribute, so all of them go on together; see `autofillAttrs`.
   */
  noAutofill: {
    type: Boolean,
    default: false
  },
  /**
   * Put the caret in this field as soon as it is on screen.
   *
   * A prop rather than the native attribute, which is what the markup used to carry and what did
   * nothing: an attribute this component does not declare falls through to the root element, and
   * `autofocus` on a plain `<div>` focuses nothing. Only one field per screen may have it — several
   * would simply race, and the last one mounted would win.
   *
   * Not for a control that arrives with the screen already open. `focus()` is exposed for that,
   * because focus is an action taken at a moment rather than a state of the field; see
   * `composables/dialog.js`, which focuses on open, and `UtilCodeEditor` on the same reasoning.
   */
  autofocus: {
    type: Boolean,
    default: false
  },
  /** Rows for `type="textarea"`. With `autogrow`, the height it starts from. */
  rows: {
    type: [String, Number],
    default: 3
  },
  /**
   * A `textarea` as tall as its content, with no scrollbar and no resize handle. For a value that
   * has to be read in full -- a token shown once, where a scrolled-off tail is a tail somebody
   * fails to copy.
   */
  autogrow: {
    type: Boolean,
    default: false
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

const isAutogrow = computed(() => props.autogrow && props.type === 'textarea')
/** Set while an `autogrow` textarea is mounted. */
let resizeObserver = null
const inputId = useId()
const errorMessage = ref(null)
const hasBlurred = ref(false)
const isRevealed = ref(false)

// COMPUTED

const hasError = computed(() => Boolean(errorMessage.value))

/*
  The opt-out attributes, as one object bound in a single `v-bind`.

  `autocomplete` is the standards half and the only one any browser reads; the four `data-`
  attributes are what the password managers that ignore it read instead -- 1Password, LastPass,
  Bitwarden and Dashlane respectively, each having settled on its own spelling. They are inert
  everywhere else, so they cost a field that nobody's extension looks at nothing.

  `new-password` rather than `off` on a password field, and that difference is the whole point on
  the fields that matter most: Chrome deliberately disregards `off` there -- too many banks had used
  it to stop people pasting -- and offers the saved credential anyway. `new-password` is the one
  value it does honour, because a field being filled with an EXISTING password is exactly what it
  says this is not. Every other type reads `off`, which they all honour.
*/
const autofillAttrs = computed(() =>
  props.noAutofill
    ? {
        autocomplete: props.type === 'password' ? 'new-password' : 'off',
        'data-1p-ignore': 'true',
        'data-lpignore': 'true',
        'data-bwignore': 'true',
        'data-form-type': 'other'
      }
    : { autocomplete: props.autocomplete }
)

/** A revealed password field renders as plain text; every other type is passed through unchanged. */
const effectiveType = computed(() =>
  props.type === 'password' && props.revealable && isRevealed.value ? 'text' : props.type
)

/*
  `pt-0.5` on the input is optical centring, not padding.

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

const isDisabled = computed(() => props.disable || props.disabled)

/** The well's states; what each one looks like is in `tailwind.css`, under `.w-field-well`. */
const controlClasses = computed(() => [
  props.dense ? 'w-field-well--dense' : '',
  props.type === 'textarea' ? 'w-field-well--multiline' : '',
  props.transparent ? 'w-field-well--transparent' : '',
  hasError.value ? 'w-field-well--error' : '',
  // -> Disabled and readonly alike: not the reader's to change
  props.readonly || isDisabled.value ? 'w-field-well--locked' : ''
])

// LIFECYCLE

onMounted(() => {
  if (props.autofocus) {
    inputEl.value?.focus()
  }
  if (isAutogrow.value && inputEl.value) {
    /*
      Refitted whenever the WIDTH changes, which is what rewraps the text: on first layout -- a field
      inside a dialog mounts before the dialog is shown, when it has no width to measure against --
      and on a resize of the window. Width only, since fitting changes the height and would
      otherwise call itself back.
    */
    let lastWidth = -1
    resizeObserver = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width
      if (width !== lastWidth) {
        lastWidth = width
        fitToContent()
      }
    })
    resizeObserver.observe(inputEl.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
})

// METHODS

/** Size an `autogrow` textarea to its content: collapsed first, so that it can shrink as well. */
function fitToContent() {
  const el = inputEl.value
  if (!isAutogrow.value || !el) {
    return
  }
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

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
  emit('focus', ev)
}

function onBlur(ev) {
  emit('blur', ev)
  hasBlurred.value = true
  if (props.rules.length && props.lazyRules !== 'ondemand') {
    validate()
  }
}

watch(
  () => props.modelValue,
  () => {
    if (isAutogrow.value) {
      nextTick(fitToContent)
    }
  }
)

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
  focus: (options) => inputEl.value?.focus(options),
  /**
   * The underlying `<input>` or `<textarea>`.
   *
   * For the few callers that need the control itself rather than its value: a caret position, a
   * selection range, a scroll offset. The comment composer's mention autocomplete is what asked for
   * it — where the `@` is in the text is a property of the element, not of the model.
   */
  el: inputEl,
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
