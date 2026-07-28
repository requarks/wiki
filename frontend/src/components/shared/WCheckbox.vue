<template>
  <!-- sized via `size` (inline style): a font-size CLASS is defeated by Quasar's unlayered `.q-icon { font-size: inherit }` -->
  <button
    type="button"
    role="checkbox"
    :aria-checked="String(isOn)"
    :aria-label="label ? undefined : ariaLabel"
    :disabled="isDisabled"
    class="w-checkbox w-unstyled inline-flex flex-nowrap items-center gap-2 rounded outline-offset-2 focus-visible:outline-2"
    :class="isDisabled ? 'pointer-events-none opacity-60' : 'cursor-pointer'"
    @click="toggle">
    <span
      class="inline-flex size-5 shrink-0 items-center justify-center rounded-sm border-2 transition-colors"
      :class="isOn ? 'border-transparent text-white' : 'border-black/54 dark:border-white/70'"
      :style="isOn ? { backgroundColor: `var(--color-${color})` } : undefined">
      <w-icon v-if="isOn" name="mdi:check" size="0.9em" />
    </span>
    <span v-if="label" class="text-body2">{{ label }}</span>
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
