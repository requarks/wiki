<template lang='pug'>
  div
    v-divider.my-0
    v-card-actions(:class='dark ? "grey darken-4-l5" : "grey lighten-4"')
      slot
</template>

<script>
export default {
  computed: {
    dark() { return this.$vuetify.theme.dark }
  }
}
</script>
