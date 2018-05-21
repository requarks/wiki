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
                  v-subheader Locale
            v-flex(lg6 xs12)
              v-card
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title
                    .subheading ---
                v-card-text ---

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
