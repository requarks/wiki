<template lang="pug">
  v-list.py-2(dense, :class='color', :dark='dark')
    slot
</template>

<script>
export default {
  props: {
    color: {
      type: String,
      default: 'primary'
    },
    dark: {
      type: Boolean,
      default: true
    }
  },
  data() {
    return {}
  }
}
</script>
