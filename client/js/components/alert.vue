<template lang="pug">
  transition(name='alert', enter-active-class="animated zoomIn", leave-active-class="animated fadeOutRight")
    .alert(v-if='shown', v-bind:class='style')
      .alert-icon: i(v-bind:class='icon')
      .alert-msg {{ msg }}
</template>

<script>
  export default {
    name: 'alert',
    data () {
      return {}
    },
    computed: {
      shown() { return this.$store.state.alert.shown },
      style() { return 'is-' + this.$store.state.alert.style },
      icon() { return 'nc-icon-outline ' + this.$store.state.alert.icon },
      msg() { return this.$store.state.alert.msg },
    }
  }
</script>
