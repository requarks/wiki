<template lang='pug'>
  v-app(:dark='darkMode').history
    nav-header
    v-content
      v-toolbar(color='primary', dark)
        .subheading Viewing history of page #[strong /{{path}}]
        v-spacer
        .caption.blue--text.text--lighten-3 ID {{id}}
        v-btn.ml-4(depressed, color='blue darken-1', @click='goLive') Return to Live Version
      v-container(fluid, grid-list-xl)
        v-layout(row, wrap)
          v-flex(xs5)
            v-chip.ma-0.grey--text.text--darken-2(
              label
              small
              color='grey lighten-2'
              )
              span Live
            v-timeline(
              dense
              )
              v-timeline-item(
                fill-dot
                color='primary'
                icon='edit'
                )
                v-card.grey.lighten-3.radius-7(flat)
                  v-card-text
                    v-layout(justify-space-between)
                      v-flex(xs7)
                        v-chip.ml-0.mr-3(
                          label
                          small
                          color='primary'
                          )
                          span.white--text Viewing
                        span Edited by John Doe
                      v-flex(xs5, text-xs-right, align-center, d-flex)
                        .caption Today at 12:34 PM

              v-timeline-item(
                fill-dot
                small
                color='primary'
                icon='edit'
                )
                v-card.grey.lighten-3.radius-7(flat)
                  v-card-text
                    v-layout(justify-space-between)
                      v-flex(xs7)
                        span Edited by Jane Doe
                      v-flex(xs5, text-xs-right, align-center, d-flex)
                        .caption Today at 12:27 PM

              v-timeline-item(
                fill-dot
                small
                color='purple'
                icon='forward'
                )
                v-card.purple.lighten-5.radius-7(flat)
                  v-card-text
                    v-layout(justify-space-between)
                      v-flex(xs7)
                        span Moved page from #[strong /test] to #[strong /home] by John Doe
                      v-flex(xs5, text-xs-right, align-center, d-flex)
                        .caption Yesterday at 10:45 AM

              v-timeline-item(
                fill-dot
                color='teal'
                icon='add'
                )
                v-card.teal.lighten-5.radius-7(flat)
                  v-card-text
                    v-layout(justify-space-between)
                      v-flex(xs7): span Initial page creation by John Doe
                      v-flex(xs5, text-xs-right, align-center, d-flex)
                        .caption Last Tuesday at 7:56 PM
            v-chip.ma-0.grey--text.text--darken-2(
              label
              small
              color='grey lighten-2'
              ) End of history

          v-flex(xs7)
            v-card.radius-7
              v-card-text
                v-card.grey.lighten-4.radius-7(flat)
                  v-card-text
                    .subheading Page Title
                    .caption Some page description

    nav-footer
</template>

<script>
/* global siteConfig */

export default {
  props: {
    id: {
      type: Number,
      default: 0
    },
    locale: {
      type: String,
      default: 'en'
    },
    path: {
      type: String,
      default: 'home'
    }
  },
  data() {
    return {}
  },
  computed: {
    darkMode() { return siteConfig.darkMode }
  },
  created () {
    this.$store.commit('page/SET_ID', this.id)
    this.$store.commit('page/SET_LOCALE', this.locale)
    this.$store.commit('page/SET_PATH', this.path)

    this.$store.commit('page/SET_MODE', 'history')
  },
  methods: {
    goLive() {
      window.location.assign(`/${this.path}`)
    }
  }
}
</script>

<style lang='scss'>

</style>
