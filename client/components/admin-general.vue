<template lang='pug'>
  v-container(fluid, fill-height, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .headline.blue--text.text--darken-2 General
        .subheading.grey--text Main settings of your wiki
        v-form.pt-3
          v-layout(row wrap)
            v-flex(lg6 xs12)
              v-card
                v-toolbar(color='blue', dark, dense, flat)
                  v-toolbar-title
                  .subheading Site Info
                v-card-text
                  v-text-field(label='Site Title', required, :counter='50')
                  v-text-field(label='Site Description', :counter='255')
            v-flex(lg6 xs12)
              v-card
                v-toolbar(color='blue', dark, dense, flat)
                  v-toolbar-title
                  .subheading Site Branding
                v-card-text
                  v-text-field(label='Site Title', required, :counter='50')
                  v-text-field(label='Site Description', :counter='255')

</template>

<script>
export default {
  data() {
    return {}
  }
}
</script>

<style lang='scss'>

</style>
