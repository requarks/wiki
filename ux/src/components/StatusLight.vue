<template lang='pug'>
.status-light(:class='cssClasses')
</template>

<script setup>
import { computed } from 'vue'

// PROPS

const props = defineProps({
  pulse: {
    type: Boolean,
    default: false
  },
  color: {
    type: String,
    default: ''
  }
})

// COMPUTED

const cssClasses = computed(() => {
  return `${props.color} ${props.pulse && 'pulsate'}`
})
</script>

<style lang="scss">
.status-light {
  display: block;
  width: 5px;
  height: 100%;
  min-height: 5px;
  border-radius: 5px;
  color: $grey-5;
  background-color: currentColor;
  background-image: linear-gradient(to bottom, transparent, rgba(255,255,255,.4));

  &.negative {
    color: $negative;
  }
  &.positive {
    color: $positive;
  }
  &.warning {
    color: $warning;
  }

  &.pulsate {
    animation: status-light-pulsate 2s ease infinite;
  }
}

@keyframes status-light-pulsate {
  0% {
    box-shadow: 0 0 5px 0 currentColor;
  }
  50% {
    box-shadow: 0 0 5px 2px currentColor;
  }
  100% {
    box-shadow: 0 0 5px 0 currentColor;
  }
}
</style>
