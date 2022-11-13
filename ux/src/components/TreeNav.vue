<template lang="pug">
.treenav

</template>

<script setup>

// PROPS

defineProps({
  nodes: {
    type: Array,
    default: () => []
  }
})

// EMITS

const emits = defineEmits(['selected'])

</script>
