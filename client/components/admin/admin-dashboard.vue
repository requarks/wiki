<template lang='pug'>
  v-card(tile, flat :color='$vuetify.dark ? "grey darken-4" : "grey lighten-5"')
    .pa-3.pt-4
      .headline.primary--text {{ $t('admin:dashboard.title') }}
      .subheading.grey--text {{ $t('admin:dashboard.subtitle') }}
    v-container(fluid, grid-list-lg)
      v-layout(row, wrap)
        v-flex(xs12 md6 lg4 xl3 d-flex)
          v-card.primary(dark)
            v-card-text
              v-icon.dashboard-icon insert_drive_file
              .subheading Pages
              animated-number.display-1(
                :value='357'
                :duration='2000'
                :formatValue='round'
                easing='easeOutQuint'
                )
        v-flex(xs12 md6 lg4 xl3 d-flex)
          v-card.indigo.lighten-1(dark)
            v-card-text
              v-icon.dashboard-icon person
              .subheading Users
              animated-number.display-1(
                :value='34'
                :duration='2000'
                :formatValue='round'
                easing='easeOutQuint'
                )
        v-flex(xs12 md6 lg4 xl3 d-flex)
          v-card.indigo.lighten-2(dark)
            v-card-text
              v-icon.dashboard-icon people
              .subheading Groups
              animated-number.display-1(
                :value='5'
                :duration='2000'
                :formatValue='round'
                easing='easeOutQuint'
                )
        v-flex(xs12 md6 lg12 xl3 d-flex)
          v-card.teal.lighten-2(dark)
            v-card-text
              v-icon.dashboard-icon blur_on
              .subheading Wiki.js 2.0.0
              .body-2 You are running the latest version.
        v-flex(xs12)
          v-card
            v-card-text ---

</template>

<script>
import AnimatedNumber from 'animated-number-vue'

export default {
  components: {
    AnimatedNumber
  },
  data() {
    return {}
  },
  methods: {
    round(val) { return Math.round(val) }
  }
}
</script>

<style lang='scss'>

.dashboard-icon {
  position: absolute;
  right: 0;
  top: 12px;
  font-size: 120px;
  opacity: .25;
}

</style>
