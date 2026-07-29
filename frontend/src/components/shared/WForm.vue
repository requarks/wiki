<template>
  <!--
    A flex column, not the `<form>` default of `display: block`.

    Six call sites already style themselves with `gap-2` / `gap-4` to space their fields, and `gap`
    does nothing on a block container -- the toggles in the page-properties panel were sitting 1px
    apart with `gap-4` set and ignored. Stacking is what every form here does, and flex children
    stretch to full width exactly as block-level ones did, so this changes nothing for the call sites
    that set no gap.
  -->
  <form novalidate class="flex flex-col" @submit.prevent="onSubmit">
    <slot />
  </form>
</template>

<script setup>
import { onBeforeUnmount, provide, ref } from 'vue'

/**
 * Form wrapper that collects its registered fields and validates them together on submit.
 *
 * Fields opt in by injecting `wFormRegister` -- see `WInput`. `novalidate` is set so validation is
 * driven entirely by the `rules` convention rather than the browser's own bubbles.
 */
const emit = defineEmits(['submit', 'validation-error'])

const fields = ref(new Set())

provide('wFormRegister', (field) => {
  fields.value.add(field)
  onBeforeUnmount(() => fields.value.delete(field))
})

/**
 * @returns {boolean} Whether every registered field passed.
 */
function validate() {
  let ok = true
  for (const field of fields.value) {
    // -> Every field runs, so the user sees all errors at once rather than one per submit
    if (field.validate?.() === false) {
      ok = false
    }
  }
  return ok
}

function onSubmit(ev) {
  if (validate()) {
    emit('submit', ev)
  } else {
    emit('validation-error')
  }
}

defineExpose({ validate })
</script>
