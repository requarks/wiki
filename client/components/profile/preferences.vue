<template lang='pug'>
  v-container(fluid, fill-height, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .headline.primary--text Preferences
        .subheading.grey--text Site settings
        v-form.pt-3
          v-layout(row wrap)
            v-flex(lg6 xs12)
              v-form
                v-card
                  v-toolbar(color='primary', dark, dense, flat)
                    v-toolbar-title
                      .subheading Display
                  v-card-text
                    v-subheader.pl-0 Locale
                    v-select(
                      outline
                      background-color='grey lighten-2'
                      hide-details
                      )
                    v-divider.mt-3
                    v-subheader.pl-0 Timezone
                    v-select(
                      outline
                      background-color='grey lighten-2'
                      hide-details
                      )
                  v-card-chin
                    v-spacer
                    v-btn(color='primary')
                      v-icon(left) chevron_right
                      span Save
            v-flex(lg6 xs12)
              v-card
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title
                    .subheading Editing
                v-card-text
                  v-subheader.pl-0 Default Editor
                  v-select(
                    outline
                    background-color='grey lighten-2'
                    hide-details
                    )
                v-card-chin
                  v-spacer
                  v-btn(color='primary')
                    v-icon(left) chevron_right
                    span Save

</template>

<script>
/* global siteConfig */

export default {
  data() {
    return { }
  },
  computed: {
    darkMode() { return siteConfig.darkMode }
  }
}
</script>

<style lang='scss'>

</style>
