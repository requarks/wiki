<template>
  <button
    type="button"
    role="radio"
    :aria-checked="String(isOn)"
    :aria-label="label ? undefined : ariaLabel"
    :disabled="isDisabled"
    class="w-radio w-unstyled inline-flex flex-nowrap items-center gap-2 rounded outline-offset-2 focus-visible:outline-2"
    :class="isDisabled ? 'pointer-events-none opacity-60' : 'cursor-pointer'"
    @click="select">
    <span
      class="inline-flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
      :class="isOn ? '' : 'border-black/54 dark:border-white/70'"
      :style="isOn ? { borderColor: `var(--color-${color})` } : undefined">
      <!-- The inner dot is scaled rather than toggled, so selecting animates instead of snapping -->
      <span
        class="size-2.5 rounded-full transition-transform"
        :class="isOn ? 'scale-100' : 'scale-0'"
        :style="{ backgroundColor: `var(--color-${color})` }" />
    </span>
    <span v-if="label" class="text-body2">{{ label }}</span>
  </button>
</template>

<script setup>
import { computed } from 'vue'

/**
 * Radio button: one choice out of several sharing a `v-model`.
 *
 * Unlike a checkbox this never clears itself -- clicking the selected option is a no-op, because a
 * radio group has no "none" state to return to. Callers that need one give the group an explicit
 * option for it.
 */
const props = defineProps({
  modelValue: {
    type: null,
    default: null
  },
  /** The value this button sets when chosen. */
  val: {
    type: null,
    default: undefined
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
  }
})

const emit = defineEmits(['update:modelValue'])

const isOn = computed(() => props.modelValue === props.val)
const isDisabled = computed(() => props.disable || props.disabled)

function select() {
  if (!isOn.value) {
    emit('update:modelValue', props.val)
  }
}
</script>
