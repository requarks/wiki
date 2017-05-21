<template lang="pug">
  p.control
    input.input(type='text', placeholder='#F0F0F0', v-model='color')
</template>

<script>
  export default {
    name: 'color-picker',
    data () {
      return {
        color: '000000'
      }
    }
  }
</script>
