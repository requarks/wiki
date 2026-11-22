<template>
  <!--
    A real <button>, so a `w-menu` or `w-tooltip` written inside it finds it as their trigger -- both
    climb to the closest button -- and `@click` / `class` from the call site land on it directly.
  -->
  <button
    type="button"
    class="w-unstyled w-field-cap"
    :aria-label="ariaLabel || undefined"
    :disabled="disable || undefined">
    <w-icon v-if="icon" :name="icon" size="18px" />
    <span v-if="label">{{ label }}</span>
    <slot />
  </button>
</template>

<script setup>
/**
 * The button that forms the end of a field: a raised key filling the trailing end of a WInput's
 * well, full height and flush with its rounded corner, rather than a flat icon sitting in the well
 * among the value.
 *
 * Written into the field's `append` slot, as its last element:
 *
 *   <w-input v-model="icon" :label="t('editor.props.icon')">
 *     <template #append>
 *       <w-field-cap icon="la:icons" :aria-label="t('iconPicker.open')">
 *         <w-menu> ... </w-menu>
 *       </w-field-cap>
 *     </template>
 *   </w-input>
 *
 * The key is `.w-field-cap` in `tailwind.css`, beside the well whose padding it reaches into.
 */
defineProps({
  icon: {
    type: String,
    default: null
  },
  /** Text beside or instead of the icon, for an action an icon alone would not name ("Generate"). */
  label: {
    type: String,
    default: null
  },
  /** Required when there is no `label`. */
  ariaLabel: {
    type: String,
    default: null
  },
  disable: {
    type: Boolean,
    default: false
  }
})
</script>
