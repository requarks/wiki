<template>
  <td
    class="w-td relative px-4 py-2 align-middle"
    :class="alignClass"
    :style="props.props?.col?.style">
    <slot />
  </td>
</template>

<script setup>
import { computed } from 'vue'

/**
 * A cell inside a `WTable` body slot.
 *
 * Takes the slot's own props object so the cell inherits its column's alignment and width without
 * the call site restating them:
 *
 *   <template #body-cell-name="props">
 *     <w-td :props="props">...</w-td>
 *   </template>
 */
const props = defineProps({
  /** The `body-cell-*` slot props, i.e. `{ row, col, value }`. */
  props: {
    type: Object,
    default: null
  }
})

const ALIGN = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right'
}

const alignClass = computed(() => ALIGN[props.props?.col?.align] ?? ALIGN.left)
</script>
