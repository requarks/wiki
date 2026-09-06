<template>
  <w-item-section avatar :top="top">
    <w-avatar
      class="blueprint-icon"
      :color="avatarBgColor"
      :text-color="avatarTextColor"
      font-size="14px"
      rounded
      :style="props.hueRotate !== 0 ? `filter: hue-rotate(` + props.hueRotate + `deg)` : ``">
      <w-badge v-if="indicatorDot" rounded :color="indicatorDot" floating>
        <w-tooltip v-if="props.indicatorText">{{ props.indicatorText }}</w-tooltip>
      </w-badge>
      <w-icon
        v-if="!textMode"
        :name="`img:/_assets/icons/ultraviolet-` + icon + `.svg`"
        size="sm" />
      <span class="uppercase" v-else>{{ props.text }}</span>
    </w-avatar>
  </w-item-section>
</template>

<script setup>
import { computed } from 'vue'

import { useDark } from '@/composables/dark'

const props = defineProps({
  icon: {
    type: String,
    default: ''
  },
  /**
   * Sit at the top of the row rather than centred in it. For a row whose section runs to several
   * lines — a hint plus a warning, a stack of checkboxes — where a centred icon drifts away from
   * the label it belongs to.
   */
  top: {
    type: Boolean,
    default: false
  },
  indicator: {
    type: String,
    default: null
  },
  indicatorText: {
    type: String,
    default: null
  },
  hueRotate: {
    type: Number,
    default: 0
  },
  text: {
    type: String,
    default: null
  }
})

// COMPOSABLES

const dark = useDark()

// COMPUTED

const textMode = computed(() => {
  return props.text !== null
})
const avatarBgColor = computed(() => {
  return dark.isActive ? 'dark-4' : 'blue-1'
})
const avatarTextColor = computed(() => {
  return dark.isActive ? 'white' : 'blue-7'
})
const indicatorDot = computed(() => {
  if (props.indicator === null) {
    return null
  }
  return props.indicator === '' ? 'pink' : props.indicator
})
</script>
