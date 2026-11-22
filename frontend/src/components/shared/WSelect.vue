<template>
  <!-- sized via `size` (inline style): a font-size CLASS is defeated by Quasar's unlayered `.q-icon { font-size: inherit }` -->
  <!--
    `max-w-full`: the field is often a flex item in a fixed-width track -- the admin rows put one
    in a `flex: 0 0 120px` section. `align-items: stretch` only ever GROWS an item to fill its
    container; it will not shrink one whose content is wider, so a text input at its natural width
    pushed the field past the section and out of the card. The cap does the shrinking, and stretch
    still handles the growing.
  -->
  <div
    class="w-select w-field w-select-theme max-w-full min-w-0"
    :class="dark ? 'w-field--dark' : ''">
    <label v-if="label" :for="selectId" class="w-field-label">
      {{ label }}
      <span v-if="required" class="text-negative pe-1" aria-hidden="true">&nbsp;*</span>
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
      :aria-readonly="!useInput && readonly ? true : undefined"
      :aria-controls="!useInput && isOpen ? `${selectId}-listbox` : undefined"
      :aria-activedescendant="
        !useInput && isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined
      "
      :disabled="useInput ? undefined : isDisabled"
      class="flex w-full flex-nowrap items-center text-start"
      :class="controlClasses"
      @click="onControlClick"
      @keydown="useInput || onKeydown($event)">
      <slot name="prepend" />

      <!--
        The selection as chips rather than a comma-joined string. Each carries its own remove
        affordance, so a value can be dropped without reopening the list.
      -->
      <span v-if="showsChips" class="flex min-w-0 flex-wrap items-center gap-1">
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
        `outline-none` because the WELL is what shows focus, with its ring: the user agent's own
        outline drew a second one inside it. Typed text and placeholder as WInput's.
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
        :aria-required="required || undefined"
        aria-haspopup="listbox"
        :aria-label="label ? undefined : ariaLabel"
        :aria-controls="isOpen ? `${selectId}-listbox` : undefined"
        :aria-activedescendant="isOpen && activeIndex >= 0 ? optionId(activeIndex) : undefined"
        :disabled="isDisabled"
        :readonly="readonly"
        :placeholder="showsChips ? '' : placeholder"
        class="w-unstyled w-field-input min-w-8 flex-1 bg-transparent pt-0.5 outline-none"
        @focus="readonly || open(0)"
        @keydown="onKeydown" />
      <span
        v-else
        class="min-w-0 flex-1 truncate pt-0.5"
        :class="hasSelection || displayValue ? '' : 'w-select-placeholder'">
        <!--
          `selected` lets a caller summarise the selection instead of listing it -- e.g. "3 groups
          selected" rather than three comma-joined names.

          Empty once the chips above are drawing the selection: the comma-joined text is what chips
          REPLACE, and rendering both said the same thing twice, side by side. The element stays for
          the layout -- it is what holds the row open and pushes the dropdown arrow to the end.

          With nothing chosen the placeholder takes the slot's place, so a caller summarising a
          selection has no empty case of its own to draw.
        -->
        <template v-if="!hasSelection && !displayValue">{{ placeholderText }}</template>
        <slot v-else name="selected">{{ showsChips ? '' : displayText }}</slot>
      </span>
      <w-spinner v-if="loading" size="1em" class="shrink-0" />
      <!--
        Drawn inline rather than through WIcon: a 2px stroked chevron, and none of the bundled icon
        sets has one -- `mdi:chevron-down` is a filled shape at a different weight.
      -->
      <span
        v-else-if="!readonly && !hideDropdownIcon"
        class="w-select-chevron"
        :class="isOpen ? 'w-select-chevron--open' : ''"
        aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </span>

      <!--
        The panel is WMenu's own element, so it is styled from here through `content-class` and a
        global rule: a scoped one only reaches elements this component renders itself.
      -->
      <w-menu
        v-model="isOpen"
        :dark="dark"
        fit
        anchor="bottom left"
        self="top left"
        :offset="[0, 8]"
        content-class="w-select-menu w-field w-select-theme">
        <div
          :id="`${selectId}-listbox`"
          role="listbox"
          :aria-multiselectable="multiple || undefined"
          class="w-select-list">
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
            class="w-select-option"
            :class="[
              optionsDense ? 'w-select-option--dense' : '',
              idx === activeIndex ? 'w-select-option--active' : '',
              idx === activeIndex && cursorByKeyboard ? 'w-select-option--keyboard' : ''
            ]"
            @click.stop="select(opt.value)"
            @mousemove="pointAt(idx)">
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
            <!--
              A tick as well as the lit cap: colour alone is a weak marker, and a multiple selection
              lights several caps at once. Inline for the same reason as the chevron above.
            -->
            <svg
              v-if="isSelected(opt.value)"
              class="w-select-tick"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </div>
          <div v-if="!filteredOptions.length" class="w-select-empty">
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
    <div v-if="showsBottom" class="w-field-help" :class="errorMessage ? 'w-field-help--error' : ''">
      {{ errorMessage || hint }}
    </div>
  </div>
</template>

<script setup>
import { computed, inject, nextTick, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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
 * Typing narrows `options` in place with `useInput`. A list too long to hand over whole -- users
 * to search on the server -- is narrowed by the caller instead, with `remoteFilter`.
 *
 * A plain select is a keycap: a raised face on a 1px skirt, sinking a pixel as it is pressed and
 * staying down while its list is open, with its label above it. The list is a raised panel of its
 * own, the selection in it a cap lit in the site's primary colour. A filtering select (`useInput`)
 * is a text field, so it is WInput's recessed well instead (`.w-field-well` in `tailwind.css`).
 */
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
  /** Shows the selection but does not open. Keeps full contrast, unlike `disable`. */
  readonly: {
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
   * With `useInput`, leave the narrowing to the caller: every change to what has been typed, and the
   * list opening, emits `filter` with the query, and `options` is listed exactly as given.
   *
   * For a search answered by the server. Bind the model to whole option objects (no `emitValue`), so
   * that a selection still has a label once a later search no longer returns it.
   */
  remoteFilter: {
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

const emit = defineEmits(['update:modelValue', 'create', 'filter'])

const isOpen = ref(false)
/** Index of the option the keyboard cursor is on; -1 when there is none. */
const activeIndex = ref(-1)
/**
 * Whether the keyboard put the cursor where it is. Only then is it ringed, as a focused option
 * would be: under the pointer it is just the hover well, and a ring following the mouse is noise.
 */
const cursorByKeyboard = ref(false)

// -> A popup closed by any route (click-away, selection, Escape) leaves no stale cursor behind
watch(isOpen, (open) => {
  if (!open) {
    activeIndex.value = -1
    cursorByKeyboard.value = false
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
  } else if (props.remoteFilter) {
    emit('filter', query.value)
  }
})
watch(query, (value) => {
  if (props.remoteFilter && isOpen.value) {
    emit('filter', value)
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
  if (!props.useInput || !query.value || props.remoteFilter) {
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
  if (props.modelValue === null || props.modelValue === undefined) {
    /*
      Nothing chosen -- unless an option IS that value. The audit filters offer "All kinds" as
      `null`, and reading null as no selection drew the field blank and left the option unticked.
    */
    return normalizedOptions.value.some((o) => o.value === props.modelValue)
      ? [props.modelValue]
      : []
  }
  return [props.modelValue]
})

const hasSelection = computed(() => selectedValues.value.length > 0)

const { t } = useI18n()

/**
 * What an empty select says: the caller's `placeholder`, or "Choose…". A blank field read as
 * broken rather than as waiting for a choice. Not for a filtering select, whose input shows the
 * caller's placeholder alone -- there the field is plainly a box to type in.
 */
const placeholderText = computed(() => props.placeholder || t('common.field.choose'))

/** Whether the selection is being drawn as chips, which is a different thing from being able to. */
const showsChips = computed(() => props.useChips && hasSelection.value)

const displayText = computed(() => {
  if (props.displayValue !== null) {
    return props.displayValue
  }
  if (!hasSelection.value) {
    return placeholderText.value
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

function pointAt(idx) {
  activeIndex.value = idx
  cursorByKeyboard.value = false
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
      cursorByKeyboard.value = true
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
        cursorByKeyboard.value = true
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

const controlClasses = computed(() => {
  const locked = props.readonly || isDisabled.value
  // -> readonly keeps the pointer from promising anything; disabled takes pointer events away entirely
  const cursor = props.readonly ? 'cursor-default' : isDisabled.value ? '' : 'cursor-pointer'
  if (!props.useInput) {
    return [
      /*
        The button reset, for the button only. On the filtering variant's <div> it would cost the
        well its padding and floor: it zeroes both, from later in the same layer.
      */
      'w-unstyled w-select-trigger',
      props.dense ? 'w-select-trigger--dense' : '',
      isOpen.value ? 'w-select-trigger--open' : '',
      errorMessage.value ? 'w-select-trigger--error' : '',
      locked ? 'w-select-trigger--locked' : '',
      isDisabled.value ? 'pointer-events-none opacity-60' : '',
      cursor
    ]
  }
  return [
    'w-field-well',
    props.dense ? 'w-field-well--dense' : '',
    // -> Chips wrap onto a second line, which needs the well to pad them top and bottom
    showsChips.value ? 'py-1' : '',
    errorMessage.value ? 'w-field-well--error' : '',
    // -> Disabled and readonly alike: WInput's locked field
    locked ? 'w-field-well--locked' : '',
    cursor
  ]
})
</script>

<!--
  Unscoped: the palette has to reach the popup panel, which is WMenu's element rather than one this
  component renders, so a scoped rule would never match it.
-->
<style>
/*
  The option palette, on the popup panel. The keycap surface itself -- face, skirt, edges -- is
  `--w-key-*` on `.w-field` in `tailwind.css`, shared with WInput's end cap.

  The lit cap -- the selected option -- is the site's primary colour, `--w-select-on`, with its darker
  face, skirt, inner edge and glow mixed from it rather than written out, as WBtnToggle's keycaps do.
  The mixes reproduce the design's shades of its blue (#1976D2): the face's lower half #1566B8, the
  skirt #0D4A87 on a light surface and #08305A on a dark one. Declared on the same element as the
  mixes that read it, since a custom property that names another resolves where it is declared.
*/
.w-select-theme {
  --w-select-opt-hover: rgb(24 28 36 / 0.05);
  --w-select-opt-in: rgb(24 28 36 / 0.1);

  --w-select-on: var(--color-primary);
  --w-select-on-top2: color-mix(in srgb, var(--w-select-on) 87%, black);
  --w-select-on-skirt: color-mix(in srgb, var(--w-select-on) 64%, black);
  --w-select-on-edge: color-mix(
    in srgb,
    color-mix(in srgb, var(--w-select-on) 33%, black) 35%,
    transparent
  );
  --w-select-on-glow: color-mix(in srgb, var(--w-select-on) 55%, transparent);
}

/*
  `--dark` is the `dark` prop, for a field on a surface that is dark in both themes; the panel opened
  from one is a `.w-dark-surface` itself, since the prop is passed on to WMenu.
*/
body.body--dark .w-select-theme,
.w-dark-surface .w-select-theme,
.w-select-theme.w-dark-surface,
.w-select-theme.w-field--dark {
  --w-select-opt-hover: rgb(0 0 0 / 0.22);
  --w-select-opt-in: rgb(0 0 0 / 0.4);
  --w-select-on-skirt: color-mix(in srgb, var(--w-select-on) 42%, black);
}

/*
  The popup: a raised panel of the same material as the field, standing on the same skirt. Unlayered,
  so it outranks the surface, radius and shadow utilities WMenu puts on every panel.
*/
.w-select-menu {
  padding: 5px;
  border-radius: 11px;
  color: var(--w-field-ink);
  background: linear-gradient(180deg, var(--w-key-top1), var(--w-key-top2));
  box-shadow:
    inset 0 1px 0 var(--w-key-hi),
    inset 0 0 0 1px var(--w-key-seam),
    0 1px 0 var(--w-key-skirt),
    0 2px 1px var(--w-key-drop),
    0 10px 20px -10px var(--w-key-drop);
  transform-origin: top center;
}

/*
  Drops into place from the field rather than WMenu's plain scale-in. While it runs the animation
  outranks the transition's starting values, and Vue waits out the longer of the two, so WMenu's own
  enter transition needs no switching off. Leaving is still WMenu's fade.
*/
.w-select-menu.w-menu-enter-active {
  animation: w-select-pop 0.16s cubic-bezier(0.3, 0.7, 0.4, 1);
}

@keyframes w-select-pop {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .w-select-menu.w-menu-enter-active {
    animation: none;
  }
}
</style>

<style scoped>
/*
  The keycap: a face lit from above (the radial gradient), a bright top edge, and a 1px skirt drawn as
  a hard shadow, over a soft drop. Pressing sinks it onto its skirt, and it stays down while its list
  is open. `--w-select-ring` is the error halo, empty until there is an error, so that every state's
  shadow carries it without restating it.
*/
.w-select-trigger {
  --w-select-ring: 0 0 transparent;
  gap: 10px;
  min-height: 40px;
  /* -> Vertical padding only matters once chips wrap onto a second line */
  padding: 4px 12px 4px 14px;
  border-radius: 9px;
  color: var(--w-field-ink);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.005em;
  background: radial-gradient(130% 100% at 50% 0%, var(--w-key-top1) 0%, var(--w-key-top2) 100%);
  box-shadow:
    inset 0 1px 0 var(--w-key-hi),
    inset 0 -2px 3px rgb(0 0 0 / 0.05),
    0 1px 0 var(--w-key-skirt),
    0 2px 1px var(--w-key-drop),
    0 4px 8px -4px var(--w-key-drop),
    var(--w-select-ring);
  transition:
    transform 0.1s cubic-bezier(0.3, 0.7, 0.4, 1),
    box-shadow 0.1s cubic-bezier(0.3, 0.7, 0.4, 1),
    filter 0.15s;
}

/* -> The design's 40px cap, down to the 36px a dense text field stands at beside it */
.w-select-trigger--dense {
  min-height: 36px;
}

/*
  The text field's error edge and halo, since the design draws no error for the select itself --
  outside the cap rather than inside it, as a raised control has no well to draw in.
*/
.w-select-trigger--error {
  --w-select-ring: var(--w-field-err-ring);
}

/* -> Locked (readonly or disabled): a cap that is not the reader's to press neither lights nor sinks */
.w-select-trigger:not(.w-select-trigger--locked):hover {
  filter: brightness(var(--w-key-hover));
}

.w-select-trigger:not(.w-select-trigger--locked):active {
  transform: translateY(1px);
  box-shadow:
    inset 0 1px 0 var(--w-key-hi),
    inset 0 -1px 2px rgb(0 0 0 / 0.05),
    0 0 0 var(--w-key-skirt),
    0 1px 1px var(--w-key-drop),
    var(--w-select-ring);
}

/* -> After `:hover` and `:active` at their specificity, so an open cap neither brightens nor moves */
.w-select-trigger--open.w-select-trigger:not(.w-select-trigger--locked) {
  filter: none;
  transform: translateY(1px);
  box-shadow:
    inset 0 1px 0 var(--w-key-hi),
    inset 0 -1px 2px rgb(0 0 0 / 0.05),
    0 0 0 var(--w-key-skirt),
    0 1px 1px var(--w-key-drop),
    0 2px 6px -3px var(--w-key-drop),
    var(--w-select-ring);
}

.w-select-trigger:focus-visible {
  outline: 2px solid var(--w-select-on);
  outline-offset: 4px;
}

.w-select-placeholder {
  color: var(--w-field-ph);
  font-weight: 400;
}

.w-select-chevron {
  flex: none;
  display: flex;
  color: var(--w-field-sub);
  transition: color 0.15s;
}

.w-select-chevron svg {
  display: block;
  width: 16px;
  height: 16px;
  transition: transform 0.2s cubic-bezier(0.3, 0.7, 0.4, 1);
}

.w-select-chevron--open {
  color: var(--w-field-acc);
}

.w-select-chevron--open svg {
  transform: rotate(180deg);
}

.w-select-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

/*
  An option is flat on the panel until the pointer or the keyboard cursor is on it, when it sinks into
  a faint well; the selected one is a cap of its own, lit in the primary colour.
*/
.w-select-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 36px;
  /* -> Vertical padding only matters for an `option` slot that runs to two lines */
  padding: 4px 10px 4px 12px;
  border-radius: 7px;
  color: var(--w-field-ink);
  font-size: 14px;
  font-weight: 500;
  text-align: start;
  cursor: pointer;
  transition:
    background-color 0.12s,
    box-shadow 0.12s;
}

.w-select-option--dense {
  min-height: 32px;
  padding-block: 2px;
}

.w-select-option--active {
  background-color: var(--w-select-opt-hover);
  box-shadow: inset 0 1px 2px var(--w-select-opt-in);
}

/* -> The design's focus ring on an option; the keyboard cursor is this list's focus */
.w-select-option--keyboard {
  outline: 2px solid var(--w-select-on);
  outline-offset: 1px;
}

/* -> After `--active` and above it, so the cursor resting on the selection does not dull it */
.w-select-option[aria-selected='true'] {
  color: #fff;
  font-weight: 600;
  background: radial-gradient(
    130% 100% at 50% 0%,
    var(--w-select-on) 0%,
    var(--w-select-on-top2) 100%
  );
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.35),
    inset 0 0 0 1px var(--w-select-on-edge),
    0 1px 0 var(--w-select-on-skirt),
    0 0 16px -5px var(--w-select-on-glow);
}

.w-select-tick {
  display: block;
  flex: none;
  width: 16px;
  height: 16px;
}

.w-select-empty {
  padding: 8px 12px;
  font-size: 14px;
  color: var(--w-field-sub);
}

@media (prefers-reduced-motion: reduce) {
  .w-select-trigger,
  .w-select-chevron,
  .w-select-chevron svg,
  .w-select-option {
    transition-duration: 0.01ms;
  }
}
</style>
