<template lang="pug">
  .toggle(:class='{ "is-active": currentValue }', @click='changeToggle')
    .toggle-container
      .toggle-pin
    .toggle-text {{ desc }}
</template>

<script>
  export default {
    name: 'toggle',
    props: ['currentValue', 'desc'],
    data () {
      return { }
    },
    methods: {
      changeToggle() {
        this.currentValue = !this.currentValue
      }
    }
  }
</script>
