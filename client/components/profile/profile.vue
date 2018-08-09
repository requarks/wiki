<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs6)
        .headline.primary--text Profile
        .subheading.grey--text Personal profile
      v-flex(xs6).text-xs-right
        v-btn(outline, color='primary').mr-0
          v-icon(left) public
          span View Public Profile
      v-flex(lg6 xs12)
        v-card
          v-toolbar(color='primary', dark, dense, flat)
            v-toolbar-title
              .subheading User Details
          v-card-text
            v-text-field(label='Name', :counter='255', v-model='name', prepend-icon='person')
            v-text-field(label='Job Title', :counter='255', prepend-icon='accessibility')
            v-text-field(label='Location / Office', :counter='255', prepend-icon='location_on')
          v-card-chin
            v-spacer
            v-btn(color='primary')
              v-icon(left) chevron_right
              span Save
        v-card.mt-3
          v-toolbar(color='purple darken-4', dark, dense, flat)
            v-toolbar-title
              .subheading Authentication
          v-card-text
            v-subheader.pl-0 Provider
            v-toolbar(
              flat
              :color='darkMode ? "grey darken-2" : "purple lighten-5"'
              dense
              :class='darkMode ? "grey--text text--lighten-1" : "purple--text text--darken-4"'
              )
              v-icon(:color='darkMode ? "grey lighten-1" : "purple darken-4"') supervised_user_circle
              .subheading.ml-3 Local
            v-divider.mt-3
            v-subheader.pl-0 Two-Factor Authentication (2FA)
            .caption.mb-2 2FA adds an extra layer of security by requiring a unique code generated on your smartphone when signing in.
            v-btn(color='purple darken-4', dark, depressed).ml-0 Enable 2FA
            v-btn(color='purple darken-4', dark, depressed, disabled).ml-0 Disable 2FA
            v-divider.mt-3
            v-subheader.pl-0 Change Password
            v-text-field(label='Current Password', prepend-icon='last_page')
            v-text-field(label='New Password', prepend-icon='last_page')
            v-text-field(label='Confirm New Password', prepend-icon='last_page')
            v-btn(color='purple darken-4', dark, depressed).ml-0 Change Password
      v-flex(lg6 xs12)
        v-card
          v-toolbar(color='primary', dark, dense, flat)
            v-toolbar-title
              .subheading Picture
          v-card-title
            v-avatar(size='64', color='grey')
              v-icon(size='64', color='grey lighten-2') account_circle
            v-btn(depressed).ml-4.elevation-1 Upload Picture
            v-btn(depressed, disabled).elevation-1 Remove Picture
        v-card.mt-3
          v-toolbar(color='teal', dark, dense, flat)
            v-toolbar-title
              .subheading Activity
          v-card-text.grey--text.text--darken-2
            .body-2.grey--text Joined on
            .body-1: strong January 1st, 2018 at 12:00 AM
            .body-2.grey--text.mt-3 Profile last updated on
            .body-1: strong January 1st, 2018 at 12:00 AM
            .body-2.grey--text.mt-3 Last login on
            .body-1: strong January 1st, 2018 at 12:00 AM
            v-divider.mt-3
            .body-2.grey--text.mt-3 Pages created
            .body-1: strong 0
            .body-2.grey--text.mt-3 Comments posted
            .body-1: strong 0
</template>

<script>
/* global siteConfig */

export default {
  data() {
    return {
      name: 'John Doe'
    }
  },
  computed: {
    darkMode() { return siteConfig.darkMode }
  }
}
</script>

<style lang='scss'>

</style>
