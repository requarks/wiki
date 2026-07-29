<template>
  <!-- sized via `size` (inline style): a font-size CLASS is defeated by Quasar's unlayered `.q-icon { font-size: inherit }` -->
  <!--
    `max-w-full`: the field is often a flex item in a fixed-width track -- the admin rows put one
    in a `flex: 0 0 120px` section. `align-items: stretch` only ever GROWS an item to fill its
    container; it will not shrink one whose content is wider, so a text input at its natural width
    pushed the field past the section and out of the card. The cap does the shrinking, and stretch
    still handles the growing.
  -->
  <div class="w-select max-w-full min-w-0">
    <!-- -> Only variants without an outline to rise into still label from above; see WInput -->
    <label
      v-if="label && !hasFloatingLabel"
      :for="selectId"
      class="mb-1 block text-caption text-black/60 dark:text-white/70">
      {{ label }}
    </label>

    <!--
      A plain select is a <button>: it gets keyboard activation, disabled semantics and focus for
      free. A filtering one cannot be, because an <input> inside a <button> is invalid and does not
      receive typing -- so that variant is a <div> and the combobox role moves onto the input. The
      listbox below is shared by both rather than duplicated.
    -->
    <component
      :is="useInput ? 'div' : 'button'"
      :id="useInput ? undefined : selectId"
      :type="useInput ? undefined : 'button'"
      :role="useInput ? undefined : 'combobox'"
      :aria-expanded="useInput ? undefined : String(isOpen)"
      :aria-haspopup="useInput ? undefined : 'listbox'"
      :aria-label="useInput || label ? undefined : ariaLabel"
      :aria-labelledby="hasFloatingLabel && !useInput ? `${selectId}-label` : undefined"
      :aria-readonly="!useInput && readonly ? true : undefined"
      :aria-controls="!useInput && isOpen ? `${selectId}-listbox` : undefined"
      :aria-activedescendant="
        !useInput && isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined
      "
      :disabled="useInput ? undefined : isDisabled"
      class="w-unstyled w-input-control flex w-full flex-nowrap items-center gap-2 rounded text-left"
      :class="controlClasses"
      :style="controlStyle"
      @click="onControlClick"
      @pointerenter="isHovered = true"
      @pointerleave="isHovered = false"
      @keydown="useInput || onKeydown($event)">
      <!-- -> The notched outline and its label, exactly as WInput draws them; CSS is shared -->
      <fieldset
        v-if="hasFloatingLabel"
        aria-hidden="true"
        class="w-input-outline"
        :style="outlineStyle">
        <legend :class="isFloating ? 'w-input-outline-notch--open' : ''">
          <span>{{ label }}</span>
        </legend>
      </fieldset>

      <!--
        A <span>, not a <label>: the control it names IS this element's ancestor for the plain
        variant (a <button>), and a label cannot sit inside the thing it labels. The control points
        at it with `aria-labelledby` instead, which names it without displacing the selected value
        the way an `aria-label` would.
      -->
      <span
        v-if="hasFloatingLabel"
        :id="`${selectId}-label`"
        class="w-input-float"
        :class="[isFloating ? 'w-input-float--up' : '', floatColorClass]">
        {{ label }}
      </span>

      <slot name="prepend" />

      <!--
        The selection as chips rather than a comma-joined string. Each carries its own remove
        affordance, so a value can be dropped without reopening the list.
      -->
      <span v-if="useChips && hasSelection" class="flex min-w-0 flex-wrap items-center gap-1">
        <w-chip
          v-for="(v, i) of selectedValues"
          :key="i"
          :label="labelFor(v)"
          size="sm"
          removable
          :remove-label="`Remove ${labelFor(v)}`"
          @remove="deselect(v)" />
      </span>

      <!--
        `outline-none` because the FIELD is what shows focus, with its ring: the user agent's own
        outline drew a second, black one inside the rounded frame. Placeholder colour matched to
        WInput's, which this had been leaving to the browser as well.
      -->
      <input
        v-if="useInput"
        :id="selectId"
        ref="input"
        v-model="query"
        type="text"
        role="combobox"
        autocomplete="off"
        :aria-expanded="String(isOpen)"
        aria-haspopup="listbox"
        :aria-label="label ? undefined : ariaLabel"
        :aria-labelledby="hasFloatingLabel ? `${selectId}-label` : undefined"
        :aria-controls="isOpen ? `${selectId}-listbox` : undefined"
        :aria-activedescendant="isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined"
        :disabled="isDisabled"
        :readonly="readonly"
        :placeholder="useChips && hasSelection ? '' : placeholder"
        class="w-unstyled min-w-8 flex-1 bg-transparent pt-0.5 outline-none placeholder:text-black/40 dark:placeholder:text-white/40"
        @focus="readonly || open(0)"
        @keydown="onKeydown" />
      <span
        v-else
        class="min-w-0 flex-1 truncate pt-0.5"
        :class="hasSelection || displayValue ? '' : 'text-black/40 dark:text-white/40'">
        <!--
          `selected` lets a caller summarise the selection instead of listing it -- e.g. "3 groups
          selected" rather than three comma-joined names.
        -->
        <slot name="selected">{{ displayText }}</slot>
      </span>
      <w-spinner v-if="loading" size="1em" class="shrink-0" />
      <w-icon
        v-else-if="!readonly && !hideDropdownIcon"
        name="mdi:menu-down"
        size="1.2em"
        class="shrink-0 transition-transform"
        :class="isOpen ? 'rotate-180' : ''" />

      <w-menu v-model="isOpen" :dark="dark" fit anchor="bottom left" self="top left">
        <div
          :id="`${selectId}-listbox`"
          role="listbox"
          :aria-multiselectable="multiple || undefined"
          class="py-1">
          <!--
            The options are plain <div>s, not buttons: focus never leaves the combobox. Keyboard
            users move a virtual cursor (`aria-activedescendant`) instead, which is the pattern for
            a listbox whose popup is teleported -- moving real focus into it would take focus out
            of the control and, on close, leave it on a detached node.
          -->
          <div
            v-for="(opt, idx) of filteredOptions"
            :id="optionId(idx)"
            :key="idx"
            role="option"
            :aria-selected="String(isSelected(opt.value))"
            class="w-select-option flex w-full cursor-pointer flex-nowrap items-center gap-2 px-4 text-left hover:bg-black/5 dark:hover:bg-white/8"
            :class="[
              optionsDense ? 'min-h-8 py-1 text-body2' : 'min-h-10 py-2',
              isSelected(opt.value) ? 'text-primary' : '',
              idx === activeIndex ? 'bg-black/8 dark:bg-white/12' : ''
            ]"
            @click.stop="select(opt.value)"
            @mousemove="activeIndex = idx">
            <!--
              A check, not a checkbox. The icon takes the row's own font size unless told otherwise,
              which made a 14px square that read as a rendering fault rather than a control -- and the
              row already announces its state by colouring itself. The column is held open when
              nothing is drawn, so labels line up whatever is selected.
            -->
            <span v-if="multiple" class="flex w-5 shrink-0 justify-center">
              <w-icon v-if="isSelected(opt.value)" name="mdi:check" size="20px" />
            </span>
            <span class="min-w-0 flex-1">
              <!--
                `option` customises the row's content only. Selection mechanics (the check and the
                click handling) stay with the component, so a caller cannot accidentally wire a
                nested control that toggles twice -- which is what the markup this replaces had to
                guard against by hand.
              -->
              <slot name="option" :opt="opt.raw" :selected="isSelected(opt.value)">
                <span class="block truncate">{{ opt.label }}</span>
              </slot>
            </span>
          </div>
          <div
            v-if="!filteredOptions.length"
            class="px-4 py-2 text-body2 text-black/54 dark:text-white/60">
            {{ noOptionsLabel }}
          </div>
        </div>
      </w-menu>
    </component>

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
      class="min-h-5 px-1 pt-1 text-caption"
      :class="errorMessage ? 'text-negative' : 'text-black/54 dark:text-white/60'">
      {{ errorMessage || hint }}
    </div>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, ref, useId, useSlots, watch } from 'vue'
import WChip from './WChip.vue'
import WMenu from './WMenu.vue'
import WSpinner from './WSpinner.vue'

/**
 * Dropdown select.
 *
 * `options` may be plain values or objects. For objects, `optionValue` / `optionLabel` name the
 * fields to read, and `emitValue` controls whether the model receives the option's value or the
 * whole object -- the same contract the existing markup is written against.
 *
 * Simplification: no free-text filtering or async search. Every current usage picks from a fixed,
 * short list.
 */
const slots = useSlots()

const props = defineProps({
  modelValue: {
    type: null,
    default: null
  },
  options: {
    type: Array,
    default: () => []
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
  /** Field holding the value, when options are objects. */
  optionValue: {
    type: String,
    default: 'value'
  },
  /** Field holding the display text, when options are objects. */
  optionLabel: {
    type: String,
    default: 'label'
  },
  /** Emit the option's value rather than the whole option object. */
  emitValue: {
    type: Boolean,
    default: false
  },
  /** Resolve the bound value back to an option for display. */
  mapOptions: {
    type: Boolean,
    default: false
  },
  multiple: {
    type: Boolean,
    default: false
  },
  outlined: {
    type: Boolean,
    default: false
  },
  /** Shows the selection but does not open. Keeps full contrast, unlike `disable`. */
  readonly: {
    type: Boolean,
    default: false
  },
  /** Filled control with no ring, which brightens when open. */
  standout: {
    type: Boolean,
    default: false
  },
  /**
   * Renders for a dark surface regardless of the app theme -- the admin sidebar is dark in both
   * themes, so its controls cannot key off the `dark:` variant.
   */
  dark: {
    type: Boolean,
    default: false
  },
  dense: {
    type: Boolean,
    default: false
  },
  /** Tighter rows in the dropdown. */
  optionsDense: {
    type: Boolean,
    default: false
  },
  loading: {
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
  hint: {
    type: String,
    default: null
  },
  hideBottomSpace: {
    type: Boolean,
    default: false
  },
  placeholder: {
    type: String,
    default: ''
  },
  noOptionsLabel: {
    type: String,
    default: 'No options'
  },
  /**
   * Type to narrow the list.
   *
   * Simplification: the component this replaces delegated filtering to the caller through a
   * `@filter` event and an `update(cb)` callback, so every caller reimplemented the same
   * case-insensitive substring match over its own list and kept the filtered copy in its own state.
   * This filters `options` itself, which is what all of them were doing by hand.
   */
  useInput: {
    type: Boolean,
    default: false
  },
  /**
   * Let what has been typed become a value of its own.
   *
   * With `useInput`, Enter on a query that matches no highlighted option emits `create` with the
   * trimmed text instead of closing the popup. The caller decides what that means — adding it to
   * `options` and to the selection, typically — because only the caller knows whether the thing is
   * allowed to exist.
   */
  create: {
    type: Boolean,
    default: false
  },
  /** Show the selection as removable chips instead of comma-joined text. */
  useChips: {
    type: Boolean,
    default: false
  },
  hideDropdownIcon: {
    type: Boolean,
    default: false
  },
  /** Replaces the computed display text outright -- for a summary like "3 locales". */
  displayValue: {
    type: String,
    default: null
  },
  /** `Array<(value) => true | string>`, same convention as WInput. */
  rules: {
    type: Array,
    default: () => []
  },
  /**
   * `'ondemand'` validates only when `validate()` is called (what WForm does on submit); any other
   * truthy value, or false, validates as soon as the selection changes.
   */
  lazyRules: {
    type: [Boolean, String],
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'create'])

const isOpen = ref(false)
/** Pointer-over, for the ring: the ring is an inline style, so CSS `:hover` cannot reach it. */
const isHovered = ref(false)
/** Index of the option the keyboard cursor is on; -1 when there is none. */
const activeIndex = ref(-1)

// -> A popup closed by any route (click-away, selection, Escape) leaves no stale cursor behind
watch(isOpen, (open) => {
  if (!open) {
    activeIndex.value = -1
  }
})

const selectId = useId()
const errorMessage = ref(null)
/** What has been typed into the filter, when `useInput`. */
const query = ref('')
const input = ref(null)

// -> A stale filter would otherwise still be narrowing the list the next time the popup opens
watch(isOpen, (open) => {
  if (!open) {
    query.value = ''
  }
})

// COMPUTED

const isDisabled = computed(() => props.disable || props.disabled)

/** Options flattened to `{ value, label, raw }`, whatever shape they came in as. */
const normalizedOptions = computed(() =>
  props.options.map((opt) => {
    if (opt !== null && typeof opt === 'object') {
      return {
        value: props.emitValue ? opt[props.optionValue] : opt,
        label: String(opt[props.optionLabel] ?? ''),
        // -> the untouched option, handed to the `option` slot so callers can read their own fields
        raw: opt
      }
    }
    return { value: opt, label: String(opt), raw: opt }
  })
)

/**
 * What the listbox actually shows. Only `useInput` narrows it -- everything else lists `options`
 * whole, so the popup and the keyboard cursor agree on one list either way.
 */
const filteredOptions = computed(() => {
  if (!props.useInput || !query.value) {
    return normalizedOptions.value
  }
  const needle = query.value.toLowerCase()
  return normalizedOptions.value.filter((o) => o.label.toLowerCase().includes(needle))
})

/*
  Keep the keyboard cursor inside the list it is pointing at. Typing narrows the options under it, and
  a cursor left past the end made Enter read an option that was no longer there.
*/
watch(filteredOptions, (options) => {
  if (activeIndex.value >= options.length) {
    activeIndex.value = options.length > 0 ? 0 : -1
  }
})

const selectedValues = computed(() => {
  if (props.multiple) {
    return Array.isArray(props.modelValue) ? props.modelValue : []
  }
  return props.modelValue === null || props.modelValue === undefined ? [] : [props.modelValue]
})

const hasSelection = computed(() => selectedValues.value.length > 0)

const displayText = computed(() => {
  if (props.displayValue !== null) {
    return props.displayValue
  }
  if (!hasSelection.value) {
    return props.placeholder
  }
  return selectedValues.value
    .map((v) => {
      const match = normalizedOptions.value.find((o) => sameValue(o.value, v))
      // -> mapOptions resolves a bare value back to its label; without it the raw value is shown
      return match && props.mapOptions !== false ? match.label : String(v?.[props.optionLabel] ?? v)
    })
    .join(', ')
})

// METHODS

/** Options are frequently objects rebuilt on each render, so identity comparison is not enough. */
function sameValue(a, b) {
  if (a === b) {
    return true
  }
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    return a[props.optionValue] !== undefined && a[props.optionValue] === b[props.optionValue]
  }
  return false
}

function isSelected(value) {
  return selectedValues.value.some((v) => sameValue(v, value))
}

/**
 * Runs `rules` and records the first failure.
 *
 * @param {*} [value] Value to test. Defaults to the current model, but callers reacting to a change
 *   must pass the *new* value: the prop still holds the old one until the parent re-renders.
 * @returns {boolean} Whether the value is valid.
 */
function validate(value = props.modelValue) {
  for (const rule of props.rules) {
    const result = rule(value)
    if (result !== true) {
      errorMessage.value = typeof result === 'string' ? result : 'Invalid'
      return false
    }
  }
  errorMessage.value = null
  return true
}

/*
  Join the enclosing WForm, if there is one, so submitting validates this control too. Optional by
  design -- plenty of selects in the codebase stand alone.
*/
const registerWithForm = inject('wFormRegister', null)
registerWithForm?.({ validate })

defineExpose({ validate })

/** Display text for a bound value, resolved back through the options where possible. */
function labelFor(value) {
  const match = normalizedOptions.value.find((o) => sameValue(o.value, value))
  return match ? match.label : String(value?.[props.optionLabel] ?? value)
}

function deselect(value) {
  const next = selectedValues.value.filter((v) => !sameValue(v, value))
  emit('update:modelValue', props.multiple ? next : (next[0] ?? null))
  revalidate(props.multiple ? next : (next[0] ?? null))
}

/**
 * A click anywhere on the filtering variant lands on the input, since the control is a plain div
 * there and only the input is focusable. The button variant just toggles, as before.
 */
function onControlClick() {
  if (props.readonly || isDisabled.value) {
    return
  }
  if (props.useInput) {
    input.value?.focus()
    return
  }
  toggle()
}

function optionId(idx) {
  return `${selectId}-opt-${idx}`
}

function toggle() {
  isOpen.value = !isOpen.value
}

/** Brings the active option into view without scrolling the page. */
async function revealActive() {
  await nextTick()
  document.getElementById(optionId(activeIndex.value))?.scrollIntoView({ block: 'nearest' })
}

function moveActive(delta) {
  const count = filteredOptions.value.length
  if (count === 0) {
    return
  }
  // -> Wraps, so ArrowUp from the top lands on the last option
  activeIndex.value = (activeIndex.value + delta + count) % count
  revealActive()
}

/**
 * Opens the popup with the cursor on the current selection, so arrowing starts from where the
 * value already is rather than from the top of the list.
 */
function open(startAt) {
  isOpen.value = true
  const selected = filteredOptions.value.findIndex((opt) => isSelected(opt.value))
  activeIndex.value = selected >= 0 ? selected : startAt
  revealActive()
}

/**
 * Keyboard handling for the combobox, following the listbox pattern: the arrows move a virtual
 * cursor, Enter commits it, Escape abandons it, and Tab leaves the control as it found it.
 */
function onKeydown(ev) {
  if (isDisabled.value || props.readonly) {
    return
  }

  const count = filteredOptions.value.length

  switch (ev.key) {
    case 'ArrowDown':
    case 'ArrowUp': {
      ev.preventDefault()
      const delta = ev.key === 'ArrowDown' ? 1 : -1
      if (isOpen.value) {
        moveActive(delta)
      } else {
        open(delta === 1 ? 0 : count - 1)
      }
      return
    }
    case 'Home':
    case 'End':
      if (isOpen.value) {
        ev.preventDefault()
        activeIndex.value = ev.key === 'Home' ? 0 : count - 1
        revealActive()
      }
      return
    case 'Enter':
    case ' ': {
      /*
        Both would otherwise reach the <button> as a click and toggle the popup shut, discarding
        the cursor. When open they commit instead; when closed the default click opens as usual.
      */
      // -> Space is a character to a field with a text input, not a commit key: it belongs to the query
      if (ev.key === ' ' && props.useInput) {
        return
      }
      if (!isOpen.value) {
        return
      }
      ev.preventDefault()
      if (activeIndex.value >= 0) {
        select(filteredOptions.value[activeIndex.value].value)
        return
      }
      // -> Nothing to commit, so what was typed is the value -- see the `create` prop
      const typed = query.value.trim()
      if (props.create && typed) {
        emit('create', typed)
        query.value = ''
        return
      }
      isOpen.value = false
      return
    }
    case 'Escape':
      if (isOpen.value) {
        ev.preventDefault()
        ev.stopPropagation()
        isOpen.value = false
      }
      return
    case 'Tab':
      // -> Leaves without committing the cursor, as a listbox should
      isOpen.value = false
  }
}

function select(value) {
  if (props.multiple) {
    const next = isSelected(value)
      ? selectedValues.value.filter((v) => !sameValue(v, value))
      : [...selectedValues.value, value]
    emit('update:modelValue', next)
    revalidate(next)
    query.value = ''
    // -> Multi-select stays open so several options can be picked in one go
    return
  }
  emit('update:modelValue', value)
  revalidate(value)
  isOpen.value = false
}

/**
 * Re-runs validation after a change, against the incoming value. In 'ondemand' mode nothing is
 * validated up front, but an error already on screen is cleared as soon as the selection satisfies
 * the rules -- leaving it visible while the user fixes the field would be misleading.
 */
function revalidate(nextValue) {
  if (!props.rules.length) {
    return
  }
  if (props.lazyRules === 'ondemand' && !errorMessage.value) {
    return
  }
  validate(nextValue)
}

/*
  The `pt-0.5` on the value span is optical centring, matching WInput -- Roboto's ascent exceeds
  its descent, so a geometrically centred line box renders its glyphs 2px high. See WInput for the
  full note.
*/
/** See the note in the template: held open only when a message could occupy it. */
const showsBottom = computed(
  () =>
    Boolean(errorMessage.value) ||
    (!props.hideBottomSpace && (props.hint || props.rules.length > 0))
)

/*
  Matches WInput: a labelled outlined field floats its label onto the outline. A `standout` control
  carries its state in its fill and draws no outline at all, so there is nothing for a label to rise
  into and it keeps its label above.
*/
const hasFloatingLabel = computed(() => Boolean(props.label) && props.outlined && !props.standout)

/*
  Open counts as focus for this control. A selection, a placeholder or a leading icon each occupy the
  resting position, so the label has to be up out of the way -- see the note in WInput.
*/
const isFloating = computed(
  () =>
    isOpen.value ||
    hasSelection.value ||
    Boolean(props.displayValue) ||
    Boolean(props.placeholder) ||
    Boolean(slots.prepend)
)

const floatColorClass = computed(() => {
  if (errorMessage.value) {
    return 'text-negative'
  }
  // -> Lightened brand blue on a dark field, matching WInput
  return isOpen.value ? 'text-primary dark:text-primary-light' : 'text-black/60 dark:text-white/70'
})

const controlClasses = computed(() => [
  props.dense ? 'w-input-control--dense min-h-9 px-2 py-1' : 'min-h-11 px-3 py-2',
  // -> Its own surface, white or a dark well, matching WInput; see the note there
  standoutClass.value ??
    (props.outlined ? 'bg-white dark:bg-black/20' : 'rounded-b-none bg-black/4 dark:bg-white/6'),
  isDisabled.value ? 'pointer-events-none opacity-60' : '',
  // -> readonly keeps full contrast; only the pointer affordance goes away
  props.readonly ? 'cursor-default' : isDisabled.value ? '' : 'cursor-pointer',
  // -> Room for the floated label above, matched below so the control stays centred in its row; see
  //    the fuller note in WInput
  hasFloatingLabel.value ? (showsBottom.value ? 'relative mt-2' : 'relative my-2') : ''
])

/** A standout control carries its state in its fill, so it takes no ring at all (see below). */
const standoutClass = computed(() => {
  if (!props.standout) {
    return null
  }
  if (props.dark) {
    return isOpen.value ? 'bg-white/22 text-white' : 'bg-white/10 text-white'
  }
  return isOpen.value ? 'bg-black/16 dark:bg-white/22' : 'bg-black/6 dark:bg-white/10'
})

/**
 * Same inset-ring frame as WInput, so a select and a text field sitting in one form agree on their
 * resting and active states. "Active" here is the open dropdown, which is this control's equivalent
 * of focus. See WInput for why this is an inline style rather than classes.
 */
const frameColor = computed(() =>
  errorMessage.value
    ? 'var(--color-negative)'
    : isOpen.value
      ? 'var(--color-primary)'
      : isHovered.value && !isDisabled.value && !props.readonly
        ? 'var(--w-input-ring-hover)'
        : 'var(--w-input-ring)'
)

const frameWidth = computed(() => (errorMessage.value || isOpen.value ? 2 : 1))

const controlStyle = computed(() => {
  // -> A floating label needs a frame it can interrupt, which the fieldset draws instead
  if (props.standout || hasFloatingLabel.value) {
    return {}
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
</script>
