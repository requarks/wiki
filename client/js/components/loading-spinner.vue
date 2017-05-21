<template lang="pug">
  i.nav-item#notifload(v-bind:class='{ "is-active": loading }')
</template>

<script>
  import { mapState } from 'vuex'

  export default {
    name: 'loading-spinner',
    computed: mapState(['loading'])
  }
</script>
