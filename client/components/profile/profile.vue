<template lang='pug'>
  v-container(fluid, fill-height, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .headline.primary--text Profile
        .subheading.grey--text Personal profile
        v-form.pt-3
          v-layout(row wrap)
            v-flex(lg6 xs12)
              v-form
                v-card
                  v-toolbar(color='primary', dark, dense, flat)
                    v-toolbar-title
                      .subheading User Details
                  v-card-text
                    v-text-field(label='Name', :counter='255', v-model='name', prepend-icon='person')
                    v-divider
                    v-text-field(label='Email', :counter='255', prepend-icon='email')
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
                    .subheading Picture
                v-card-text ---
              v-card.mt-3
                v-toolbar(color='teal', dark, dense, flat)
                  v-toolbar-title
                    .subheading Activity
                v-card-text.grey--text.text--darken-2
                  .body-1 Joined #[strong January 1st, 2010]
                  .body-1 Last login on #[strong January 2nd, 2010]
</template>

<script>

export default {
  data() {
    return {
      name: 'John Doe'
    }
  }
}
</script>

<style lang='scss'>

</style>
