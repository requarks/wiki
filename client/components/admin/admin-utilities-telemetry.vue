<template lang='pug'>
  v-card
    v-toolbar(flat, color='primary', dark, dense)
      .subheading {{ $t('admin:utilities.telemetryTitle') }}
    v-form
      v-card-text
        v-subheader What is telemetry?
        .body-1.pl-3 Telemetry allows the developers of Wiki.js to improve the software by collecting basic anonymized data about its usage and the host info. #[br] This is entirely optional and #[strong absolutely no] private data (such as content or personal data) is collected.
        .body-1.pt-3.pl-3 For maximum privacy, a random client ID is generated during setup. This ID is used to group requests together while keeping complete anonymity. You can reset and generate a new one below at any time.
        v-divider.my-3
        v-subheader What is collected?
        .body-1.pl-3 When telemetry is enabled, only the following data is transmitted:
        v-list
          v-list-item
            v-list-item-avatar: v-icon info_outline
            v-list-item-content
              v-list-item-title.body-1 Version of Wiki.js installed
              v-list-item-sub-title.caption: em e.g. v2.0.123
          v-list-item
            v-list-item-avatar: v-icon info_outline
            v-list-item-content
              v-list-item-title.body-1 Basic OS information
              v-list-item-sub-title.caption: em Platform (Linux, macOS or Windows), Total CPU cores and DB type (PostgreSQL, MySQL, MariaDB, SQLite or SQL Server)
          v-list-item
            v-list-item-avatar: v-icon info_outline
            v-list-item-content
              v-list-item-title.body-1 Crash debug data
              v-list-item-sub-title.caption: em Stack trace of the error
          v-list-item
            v-list-item-avatar: v-icon info_outline
            v-list-item-content
              v-list-item-title.body-1 Setup analytics
              v-list-item-sub-title.caption: em Installation checkpoint reached
        .body-1.pl-3 Note that crash debug data is stored for a maximum of 30 days while analytics are stored for a maximum of 16 months, after which it is permanently deleted.
        v-divider.my-3
        v-subheader What is it used for?
        .body-1.pl-3 Telemetry is used by developers to improve Wiki.js, mostly for the following reasons:
        v-list(dense)
          v-list-item
            v-list-item-avatar: v-icon chevron_right
            v-list-item-content: v-list-item-title.body-1 Identify critical bugs more easily and fix them in a timely manner.
          v-list-item
            v-list-item-avatar: v-icon chevron_right
            v-list-item-content: v-list-item-title.body-1 Understand the upgrade rate of current installations.
          v-list-item
            v-list-item-avatar: v-icon chevron_right
            v-list-item-content: v-list-item-title.body-1  Optimize performance and testing scenarios based on most popular environments.
        .body-1.pl-3 Only authorized developers have access to the data. It is not shared to any 3rd party nor is it used for any other application than improving Wiki.js.
        v-divider.my-3
        v-subheader Settings
        .pl-3
          v-switch.mt-0(
            v-model='telemetry',
            label='Enable Telemetry',
            color='primary',
            hint='Allow Wiki.js to transmit telemetry data.',
            persistent-hint
          )
          .subheading.mt-3.grey--text.text--darken-1 Client ID
          .body-1 {{clientId}}
      v-card-chin
        v-btn(depressed, color='success', @click='updateTelemetry')
          v-icon(left) chevron_right
          | Save Changes
        v-spacer
        v-btn(outline, color='grey', @click='resetClientId')
          v-icon(left) autorenew
          span Reset Client ID

</template>

<script>
import _ from 'lodash'

import utilityTelemetryResetIdMutation from 'gql/admin/utilities/utilities-mutation-telemetry-resetid.gql'
import utilityTelemetrySetMutation from 'gql/admin/utilities/utilities-mutation-telemetry-set.gql'
import utilityTelemetryQuery from 'gql/admin/utilities/utilities-query-telemetry.gql'

export default {
  data() {
    return {
      telemetry: false,
      clientId: 'N/A'
    }
  },
  methods: {
    async updateTelemetry() {
      this.loading = true
      this.$store.commit(`loadingStart`, 'admin-utilities-telemetry-set')

      try {
        const respRaw = await this.$apollo.mutate({
          mutation: utilityTelemetrySetMutation,
          variables: {
            enabled: this.telemetry
          }
        })
        const resp = _.get(respRaw, 'data.system.setTelemetry.responseResult', {})
        if (resp.succeeded) {
          this.$store.commit('showNotification', {
            message: 'Telemetry updated successfully.',
            style: 'success',
            icon: 'check'
          })
        } else {
          throw new Error(resp.message)
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }

      this.$store.commit(`loadingStop`, 'admin-utilities-telemetry-set')
      this.loading = false
    },
    async resetClientId() {
      this.loading = true
      this.$store.commit(`loadingStart`, 'admin-utilities-telemetry-resetid')

      try {
        const respRaw = await this.$apollo.mutate({
          mutation: utilityTelemetryResetIdMutation
        })
        const resp = _.get(respRaw, 'data.system.resetTelemetryClientId.responseResult', {})
        if (resp.succeeded) {
          this.$apollo.queries.telemetry.refetch()
          this.$store.commit('showNotification', {
            message: 'Telemetry Client ID reset successfully.',
            style: 'success',
            icon: 'check'
          })
        } else {
          throw new Error(resp.message)
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }

      this.$store.commit(`loadingStop`, 'admin-utilities-telemetry-resetid')
      this.loading = false
    }
  },
  apollo: {
    telemetry: {
      query: utilityTelemetryQuery,
      fetchPolicy: 'network-only',
      manual: true,
      result ({ data }) {
        this.telemetry = _.get(data, 'system.info.telemetry', false)
        this.clientId = _.get(data, 'system.info.telemetryClientId', 'N/A')
      },
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-utilities-telemetry-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
