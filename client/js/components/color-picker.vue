<template lang="pug">
  .colorpicker
    .colorpicker-choice(v-for='color in colors', :class='["is-" + color, color === value ? "is-active" : ""]', @click='setColor(color)')
</template>

<script>
  export default {
    name: 'color-picker',
    props: ['value'],
    data () {
      return {
        colors: [
          'red',
          'pink',
          'purple',
          'deep-purple',
          'indigo',
          'blue',
          'light-blue',
          'cyan',
          'teal',
          'green',
          'light-green',
          'lime',
          'yellow',
          'amber',
          'orange',
          'deep-orange',
          'brown',
          'grey',
          'blue-grey'
        ]
      }
    },
    methods: {
      setColor(color) {
        this.$emit('input', color)
      }
    }
  }
</script>
