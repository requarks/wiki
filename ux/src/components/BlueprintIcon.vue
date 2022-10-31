<template lang='pug'>
q-item-section(avatar)
  q-avatar.blueprint-icon(
    :color='avatarBgColor'
    :text-color='avatarTextColor'
    font-size='14px'
    rounded
    :style='props.hueRotate !== 0 ? `filter: hue-rotate(` + props.hueRotate + `deg)` : ``'
    )
    q-badge(
      v-if='indicatorDot'
      rounded
      :color='indicatorDot'
      floating
      )
      q-tooltip(v-if='props.indicatorText') {{props.indicatorText}}
    q-icon(
      v-if='!textMode'
      :name='`img:/_assets/icons/ultraviolet-` + icon + `.svg`'
      size='sm'
    )
    span.text-uppercase(v-else) {{props.text}}
</template>

<script setup>
import { computed } from 'vue'
import { useQuasar } from 'quasar'

const props = defineProps({
  icon: {
    type: String,
    default: ''
  },
  dark: {
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

// QUASAR

const $q = useQuasar()

// COMPUTED

const textMode = computed(() => { return props.text !== null })
const avatarBgColor = computed(() => { return $q.dark.isActive || props.dark ? 'dark-4' : 'blue-1' })
const avatarTextColor = computed(() => { return $q.dark.isActive || props.dark ? 'white' : 'blue-7' })
const indicatorDot = computed(() => {
  if (props.indicator === null) { return null }
  return (props.indicator === '') ? 'pink' : props.indicator
})
</script>
