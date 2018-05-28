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
                    v-select.grey.lighten-5(solo, flat)
                    v-divider
                    v-subheader.pl-0 Timezone
                    v-select.grey.lighten-5(solo, flat)
                  v-divider.my-0
                  v-card-actions.grey.lighten-4
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
                  v-select.grey.lighten-5(solo, flat)
                v-divider.my-0
                v-card-actions.grey.lighten-4
                  v-spacer
                  v-btn(color='primary')
                    v-icon(left) chevron_right
                    span Save

</template>

<script>

export default {
  data() {
    return { }
  }
}
</script>

<style lang='scss'>

</style>
