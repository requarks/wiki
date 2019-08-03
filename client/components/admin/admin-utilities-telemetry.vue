<template lang='pug'>
  v-card
    v-toolbar(flat, color='primary', dark, dense)
      .subtitle-1 {{ $t('admin:utilities.telemetryTitle') }}
    v-form
      v-card-text
        .subtitle-2 What is telemetry?
        .body-2.mt-3 Telemetry allows the developers of Wiki.js to improve the software by collecting basic anonymized data about its usage and the host info. #[br] This is entirely optional and #[strong absolutely no] private data (such as content or personal data) is collected.
        .body-2.mt-3 For maximum privacy, a random client ID is generated during setup. This ID is used to group requests together while keeping complete anonymity. You can reset and generate a new one below at any time.
        v-divider.my-4
        .subtitle-2 What is collected?
        .body-2.mt-3 When telemetry is enabled, only the following data is transmitted:
        v-list
          v-list-item
            v-list-item-avatar: v-icon mdi-information-outline
            v-list-item-content
              v-list-item-title.body-2 Version of Wiki.js installed
              v-list-item-subtitle.caption: em e.g. v2.0.123
          v-list-item
            v-list-item-avatar: v-icon mdi-information-outline
            v-list-item-content
              v-list-item-title.body-2 Basic OS information
              v-list-item-subtitle.caption: em Platform (Linux, macOS or Windows), Total CPU cores and DB type (PostgreSQL, MySQL, MariaDB, SQLite or SQL Server)
          v-list-item
            v-list-item-avatar: v-icon mdi-information-outline
            v-list-item-content
              v-list-item-title.body-2 Crash debug data
              v-list-item-subtitle.caption: em Stack trace of the error
          v-list-item
            v-list-item-avatar: v-icon mdi-information-outline
            v-list-item-content
              v-list-item-title.body-2 Setup analytics
              v-list-item-subtitle.caption: em Installation checkpoint reached
        .body-2 Note that crash debug data is stored for a maximum of 30 days while analytics are stored for a maximum of 16 months, after which it is permanently deleted.
        v-divider.my-4
        .subtitle-2 What is it used for?
        .body-2.mt-3 Telemetry is used by developers to improve Wiki.js, mostly for the following reasons:
        v-list(dense)
          v-list-item
            v-list-item-avatar: v-icon mdi-chevron-right
            v-list-item-content: v-list-item-title: .body-2 Identify critical bugs more easily and fix them in a timely manner.
          v-list-item
            v-list-item-avatar: v-icon mdi-chevron-right
            v-list-item-content: v-list-item-title: .body-2 Understand the upgrade rate of current installations.
          v-list-item
            v-list-item-avatar: v-icon mdi-chevron-right
            v-list-item-content: v-list-item-title: .body-2  Optimize performance and testing scenarios based on most popular environments.
        .body-2 Only authorized developers have access to the data. It is not shared to any 3rd party nor is it used for any other application than improving Wiki.js.
        v-divider.my-4
        .subtitle-2 Settings
        .mt-3
          v-switch.mt-0(
            v-model='telemetry',
            label='Enable Telemetry',
            color='primary',
            hint='Allow Wiki.js to transmit telemetry data.',
            persistent-hint
          )
        v-divider.my-4
        .subtitle-2.mt-3.grey--text.text--darken-1 Client ID
        .body-2.mt-2 {{clientId}}
      v-card-chin
        v-btn.px-3(depressed, color='success', @click='updateTelemetry')
          v-icon(left) mdi-chevron-right
          | Save Changes
        v-spacer
        v-btn.px-3(outlined, color='grey', @click='resetClientId')
          v-icon(left) mdi-autorenew
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
