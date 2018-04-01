<template lang='pug'>
  v-card(flat)
    v-card(color='grey lighten-5')
      .pa-3.pt-4
        .headline.primary--text Utilities
        .subheading.grey--text Maintenance and troubleshooting tools
    v-tabs(v-model='tab', color='grey lighten-4', fixed-tabs, slider-color='primary', show-arrows)
      v-tab(key='tools') Tools
      v-tab(key='telemetry') Telemetry
      v-tab(key='telemetry') Support

      v-tab-item(key='tools', :transition='false', :reverse-transition='false')
        v-container.grey.lighten-5(fluid, grid-list-lg)
          v-layout(row, wrap)
            v-flex(xs12, sm6)
              v-card
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title
                    .subheading Authentication
                v-subheader Flush User Sessions
                v-card-text.pt-0
                  .body-1 This will cause all users to be logged out. You will need to log back in after the operation.
                  v-btn(depressed).ml-0
                    v-icon(left, color='grey') build
                    span Proceed
                v-subheader Reset Guest User
                v-card-text.pt-0
                  .body-1 This will reset the guest user to its default parameters and permissions.
                  v-btn(depressed).ml-0
                    v-icon(left, color='grey') build
                    span Proceed
            v-flex(xs12, sm6)
              v-card
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title
                    .subheading Maintenance Mode
                v-card-text
                  .body-1 Maintenance mode restrict access to the site to administrators only, regarless of current permissions.
                  v-btn.mt-3(color='orange darken-2', dark)
                    icon-home-alert.mr-2(fillColor='#FFFFFF')
                    | Turn On Maintenance Mode

      v-tab-item(key='telemetry', :transition='false', :reverse-transition='false')
        v-card.pa-3
          v-form
            v-subheader What is telemetry?
            .body-1.pl-3 Telemetry allows the developers of Wiki.js to improve the software by collecting basic anonymized data about its usage and the host info. #[br] This is entirely optional and #[strong absolutely no] private data (such as content or personal data) is collected.
            .body-1.pt-3.pl-3 For maximum privacy, a random client ID is generated every time Wiki.js is started. This ID is used to group requests together while keeping complete anonymity.
            v-divider
            v-subheader What is collected?
            .body-1.pl-3 When telemetry is enabled, only the following data is transmitted:
            v-list(dense)
              v-list-tile
                v-list-tile-avatar: v-icon info_outline
                v-list-tile-content: v-list-tile-title.caption Version of Wiki.js installed
              v-list-tile
                v-list-tile-avatar: v-icon info_outline
                v-list-tile-content: v-list-tile-title.caption Basic OS information (version, CPU cores, RAM available)
              v-list-tile
                v-list-tile-avatar: v-icon info_outline
                v-list-tile-content: v-list-tile-title.caption Crash debug data
              v-list-tile
                v-list-tile-avatar: v-icon info_outline
                v-list-tile-content: v-list-tile-title.caption Setup analytics (step reached)
            .body-2.pl-3
            v-divider
            v-subheader Settings
            .pl-3
              v-switch(
                v-model='telemetry',
                label='Enable Telemetry',
                :value='true',
                color='primary',
                hint='Allow Wiki.js to transmit telemetry data.',
                persistent-hint
              )
              .subheading.mt-3.grey--text.text--darken-1 Client ID
              .body-1 xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
            v-divider
            v-card-actions
              v-btn(color='primary')
                v-icon(left) chevron_right
                | Save Changes
              v-spacer
              v-btn(outline, color='grey')
                v-icon(left) autorenew
                span Reset Client ID
</template>

<script>
export default {
  data() {
    return {
      tab: '0',
      telemetry: true
    }
  },
  methods: {
    resetClientID() {

    }
  }
}
</script>

<style lang='scss'>

</style>
