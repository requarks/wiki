<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .profile-header
          img.animated.fadeInUp(src='/svg/icon-profile.svg', alt='Users', style='width: 80px;')
          .profile-header-title
            .headline.primary--text.animated.fadeInLeft Profile
            .subheading.grey--text.animated.fadeInLeft Personal profile
          v-spacer
          v-btn.animated.fadeInDown(outlined, color='primary', disabled).mr-0
            v-icon(left) mdi-earth
            span View Public Profile
      v-flex(lg6 xs12)
        v-card
          v-toolbar(color='primary', dark, dense, flat)
            v-toolbar-title.subtitle-1 User Details
          v-card-text
            v-text-field(label='Name', :counter='255', v-model='name', prepend-icon='mdi-account')
            v-text-field(label='Job Title', :counter='255', prepend-icon='mdi-human')
            v-text-field(label='Location / Office', :counter='255', prepend-icon='mdi-map-marker')
          v-card-chin
            v-spacer
            v-btn.px-4(color='success')
              v-icon(left) mdi-content-save
              span {{$t('common:actions.save')}}
        v-card.mt-3
          v-toolbar(color='primary', dark, dense, flat)
            v-toolbar-title
              .subtitle-1 Authentication
          v-card-text
            v-subheader.pl-0 Provider
            v-toolbar(
              flat
              :color='$vuetify.theme.dark ? "grey darken-2" : "purple lighten-5"'
              dense
              :class='$vuetify.theme.dark ? "grey--text text--lighten-1" : "purple--text text--darken-4"'
              )
              v-icon(:color='$vuetify.theme.dark ? "grey lighten-1" : "purple darken-4"') mdi-shield-lock
              .subheading.ml-3 Local
            v-divider.mt-3
            v-subheader.pl-0 Two-Factor Authentication (2FA)
            .caption.mb-2 2FA adds an extra layer of security by requiring a unique code generated on your smartphone when signing in.
            v-btn(color='purple darken-4', disabled).ml-0 Enable 2FA
            v-btn(color='purple darken-4', dark, depressed, disabled).ml-0 Disable 2FA
            v-divider.mt-3
            v-subheader.pl-0 Change Password
            v-text-field(label='Current Password', type='password', prepend-icon='mdi-textbox-password')
            v-text-field(label='New Password', type='password', prepend-icon='mdi-textbox-password')
            v-text-field(label='Confirm New Password', type='password', prepend-icon='mdi-textbox-password')
          v-card-chin
            v-spacer
            v-btn.px-4(color='purple darken-4', dark)
              v-icon(left) mdi-progress-check
              span Change Password
      v-flex(lg6 xs12)
        v-card
          v-toolbar(color='primary', dark, dense, flat)
            v-toolbar-title
              .subtitle-1 Picture
          v-card-title
            v-avatar(size='64', color='grey')
              v-icon(size='64', color='grey lighten-2') mdi-account-circle
            v-btn(depressed).mx-4.elevation-1 Upload Picture
            v-btn(depressed, disabled).elevation-1 Remove Picture
        v-card.mt-3
          v-toolbar(color='teal', dark, dense, flat)
            v-toolbar-title
              .subtitle-1 Activity
          v-card-text.grey--text.text--darken-2
            .caption.grey--text Joined on
            .body-2: strong January 1st, 2018 at 12:00 AM
            .caption.grey--text.mt-3 Profile last updated on
            .body-2: strong January 1st, 2018 at 12:00 AM
            .caption.grey--text.mt-3 Last login on
            .body-2: strong January 1st, 2018 at 12:00 AM
            v-divider.mt-3
            .caption.grey--text.mt-3 Pages created
            .body-2: strong 0
            .caption.grey--text.mt-3 Comments posted
            .body-2: strong 0
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
