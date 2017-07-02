<template lang="pug">
  .toggle(:class='{ "is-active": value }', @click='changeToggle')
    .toggle-container
      .toggle-pin
    .toggle-text {{ desc }}
</template>

<script>
  export default {
    name: 'toggle',
    props: ['value', 'desc'],
    data () {
      return { }
    },
    methods: {
      changeToggle() {
        this.$emit('input', !this.value)
      }
    }
  }
</script>
