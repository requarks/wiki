<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img(src='/svg/icon-maintenance.svg', alt='Utilities', style='width: 80px;')
          .admin-header-title
            .headline.primary--text Utilities
            .subheading.grey--text Maintenance and troubleshooting tools

        v-card.mt-3
          v-tabs(color='grey darken-2', fixed-tabs, slider-color='white', show-arrows, dark)
            v-tab(key='tools') Tools
            v-tab(key='cache') Cache
            v-tab(key='telemetry') Telemetry
            v-tab(key='support') Support

            v-tab-item(key='tools', :transition='false', :reverse-transition='false')
              v-container.pa-2(fluid, grid-list-sm, :class='$vuetify.dark ? "" : "grey lighten-5"')
                v-layout(row, wrap)
                  v-flex(xs12, sm6)
                    v-card
                      v-toolbar(:color='$vuetify.dark ? "" : "grey darken-3"', dark, dense, flat)
                        v-toolbar-title
                          .subheading Authentication
                        v-spacer
                        v-chip(label, color='white', small).grey--text.text--darken-2 coming soon
                      v-subheader Flush User Sessions
                      v-card-text.pt-0.pl-4
                        .body-1 This will cause all users to be logged out. You will need to log back in after the operation.
                        v-btn(depressed).ml-0
                          v-icon(left, color='grey') build
                          span Proceed
                      v-divider.my-0
                      v-subheader Reset Guest User
                      v-card-text.pt-0.pl-4
                        .body-1 This will reset the guest user to its default parameters and permissions.
                        v-btn(depressed).ml-0
                          v-icon(left, color='grey') build
                          span Proceed
                    v-card.mt-3
                      v-toolbar(:color='$vuetify.dark ? "" : "grey darken-3"', dark, dense, flat)
                        v-toolbar-title
                          .subheading Modules
                        v-spacer
                        v-chip(label, color='white', small).grey--text.text--darken-2 coming soon
                      v-subheader Rescan Modules
                      v-card-text.pt-0.pl-4
                        .body-1 Look for new modules on disk. Existing configurations will be merged.
                        v-select.mt-3(
                          v-model='rescanModuleType'
                          :items='moduleTypes'
                          label='Modules Type'
                          outline
                          background-color='grey lighten-1'
                          hide-details
                          dense
                        )
                        v-btn.ml-0(color='primary', depressed, dark)
                          v-icon(left) chevron_right
                          span Rescan
                  v-flex(xs12, sm6)
                    v-card
                      v-toolbar(:color='$vuetify.dark ? "" : "grey darken-3"', dark, dense, flat)
                        v-toolbar-title
                          .subheading Maintenance Mode
                        v-spacer
                        v-chip(label, color='white', small).grey--text.text--darken-2 coming soon
                      v-card-text
                        .body-1 Maintenance mode restrict access to the site to administrators only, regarless of current permissions.
                        v-btn.mt-3.ml-0(color='orange darken-2', depressed, dark)
                          icon-home-alert.mr-2(fillColor='#FFFFFF')
                          | Turn On Maintenance Mode
                    v-card.mt-3
                      v-toolbar(:color='$vuetify.dark ? "" : "grey darken-3"', dark, dense, flat)
                        v-toolbar-title
                          .subheading Graph Endpoint
                        v-spacer
                        v-chip(label, color='white', small).grey--text.text--darken-2 coming soon
                      v-card-text
                        .body-1 The Graph API Endpoint from which remote resources like locales, themes and plugins are fetched.
                        .caption.red--text Do not change unless you know what you're doing!
                        v-text-field.my-2(outline, hide-details, background-color='grey lighten-1', label='Graph Endpoint', value='https://graph.requarks.io')
                        v-btn.ml-0(color='primary', depressed, dark)
                          v-icon(left) chevron_right
                          span Save

            v-tab-item(key='cache', :transition='false', :reverse-transition='false')
              v-card
                v-card-text Coming soon

            v-tab-item(key='telemetry', :transition='false', :reverse-transition='false')
              v-card
                v-form
                  v-card-text
                    v-subheader What is telemetry?
                    .body-1.pl-3 Telemetry allows the developers of Wiki.js to improve the software by collecting basic anonymized data about its usage and the host info. #[br] This is entirely optional and #[strong absolutely no] private data (such as content or personal data) is collected.
                    .body-1.pt-3.pl-3 For maximum privacy, a random client ID is generated during setup. This ID is used to group requests together while keeping complete anonymity. You can reset and generate a new one below at any time.
                    v-divider.my-3
                    v-subheader What is collected?
                    .body-1.pl-3 When telemetry is enabled, only the following data is transmitted:
                    v-list(dense)
                      v-list-tile
                        v-list-tile-avatar: v-icon info_outline
                        v-list-tile-content: v-list-tile-title.caption Version of Wiki.js installed
                      v-list-tile
                        v-list-tile-avatar: v-icon info_outline
                        v-list-tile-content: v-list-tile-title.caption Basic OS information (platform, CPU cores count, DB type)
                      v-list-tile
                        v-list-tile-avatar: v-icon info_outline
                        v-list-tile-content: v-list-tile-title.caption Crash debug data
                      v-list-tile
                        v-list-tile-avatar: v-icon info_outline
                        v-list-tile-content: v-list-tile-title.caption Setup analytics (installation checkpoint reached)
                    .body-2.pl-3
                    v-divider.my-3
                    v-subheader Settings
                    .pl-3
                      v-switch.mt-0(
                        v-model='telemetry',
                        label='Enable Telemetry',
                        :value='true',
                        color='primary',
                        hint='Allow Wiki.js to transmit telemetry data.',
                        persistent-hint
                      )
                      .subheading.mt-3.grey--text.text--darken-1 Client ID
                      .body-1 xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
                  v-card-chin
                    v-btn(color='primary', @click='updateTelemetry')
                      v-icon(left) chevron_right
                      | Save Changes
                    v-spacer
                    v-btn(outline, color='grey', @click='resetClientId')
                      v-icon(left) autorenew
                      span Reset Client ID

            v-tab-item(key='support', :transition='false', :reverse-transition='false')
              v-card.pa-3
                v-subheader Report a bug
                .body-1.pl-3 Bugs can be reported using GitHub issues on the project repository page.
                v-btn.ml-3.mt-3(depressed, dark, color='grey darken-2', href='https://github.com/Requarks/wiki/issues', target='_blank')
                  icon-github-circle.mr-3(fillColor='#FFFFFF')
                  span Submit an issue
                v-divider.my-3
                v-subheader Suggest a New Feature / Enhancement
                .body-1.pl-3 Have an idea for a new feature or something that could be improved?
                v-btn.ml-3.mt-3(depressed, dark, color='indigo', href='https://requests.requarks.io/wiki', target='_blank')
                  v-icon(left) lightbulb_outline
                  span Submit an idea
                v-divider.my-3
                v-subheader Questions / Comments
                .body-1.pl-3 Join our gitter channel. We are very active and friendly!
                v-btn.ml-3.mt-3(depressed, dark, color='pink', href='https://gitter.im/Requarks/wiki', target='_blank')
                  v-icon(left) chat
                  span Launch Gitter

</template>

<script>
import IconGithubCircle from 'mdi/GithubCircle'
import IconHomeAlert from 'mdi/HomeAlert'

export default {
  components: {
    IconGithubCircle,
    IconHomeAlert
  },
  data() {
    return {
      tab: '0',
      moduleTypes: [
        { text: 'Authentication', value: 'authentication' },
        { text: 'Editor', value: 'editor' },
        { text: 'Logging', value: 'logging' },
        { text: 'Rendering', value: 'renderer' },
        { text: 'Search Engine', value: 'search' },
        { text: 'Storage', value: 'storage' }
      ],
      rescanModuleType: 'authentication',
      telemetry: true
    }
  },
  methods: {
    updateTelemetry() {
      this.$store.commit('showNotification', {
        style: 'indigo',
        message: `Coming soon...`,
        icon: 'directions_boat'
      })
    },
    resetClientId() {
      this.$store.commit('showNotification', {
        style: 'indigo',
        message: `Coming soon...`,
        icon: 'directions_boat'
      })
    }
  }
}
</script>

<style lang='scss'>

</style>
