<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-rest-api.svg', alt='API', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft API Access
            .subtitle-1.grey--text.animated.fadeInLeft Manage keys to access the API
          v-spacer
          template(v-if='enabled')
            status-indicator.mr-3(positive, pulse)
            .caption.green--text.animated.fadeInLeft {{$t('admin:api.enabled')}}
          template(v-else)
            status-indicator.mr-3(negative, pulse)
            .caption.red--text.animated.fadeInLeft {{$t('admin:api.disabled')}}
          v-spacer
          v-btn.mr-3.animated.fadeInDown.wait-p2s(outlined, color='grey', large, @click='refresh')
            v-icon mdi-refresh
          v-btn.mr-3.animated.fadeInDown.wait-p1s(color='green', depressed, large, @click='globalSwitch', dark)
            v-icon(left) mdi-power
            | Enable API
          v-btn.animated.fadeInDown(color='primary', depressed, large, @click='newKey', dark)
            v-icon(left) mdi-plus
            | New API Key
        v-card.mt-3.animated.fadeInUp
          v-simple-table(v-if='keys && keys.length > 0')
            template(v-slot:default)
              thead
                tr.grey(:class='$vuetify.theme.dark ? `darken-4-d5` : `lighten-5`')
                  th Name
                  th Key Ending
                  th Expiration
                  th Created
                  th Last Updated
                  th(width='100') Revoke
              tbody
                tr(v-for='key of keys', :key='`key-` + key.id')
                  td: strong {{ key.name }}
                  td.caption {{ key.keyShort }}
                  td {{ key.expiration | moment('calendar') }}
                  td {{ key.createdAt | moment('calendar') }}
                  td {{ key.updatedAt | moment('calendar') }}
                  td: v-btn(icon): v-icon(color='error') mdi-cancel
          v-card-text(v-else)
            v-alert.mb-0(icon='mdi-information', :value='true', outlined, color='info') No API keys have been generated yet.

    create-api-key(v-model='isCreateDialogShown', @refresh='refresh(false)')
</template>

<script>
import gql from 'graphql-tag'
import { StatusIndicator } from 'vue-status-indicator'

import CreateApiKey from './admin-api-create.vue'

export default {
  components: {
    StatusIndicator,
    CreateApiKey
  },
  data() {
    return {
      enabled: false,
      keys: [],
      isCreateDialogShown: false
    }
  },
  methods: {
    async refresh(notify = true) {
      this.$apollo.queries.keys.refetch()
      if (notify) {
        this.$store.commit('showNotification', {
          message: 'List of API keys has been refreshed.',
          style: 'success',
          icon: 'cached'
        })
      }
    },
    async globalSwitch() {
      this.$store.commit('showNotification', {
        style: 'indigo',
        message: `Coming soon...`,
        icon: 'directions_boat'
      })
    },
    async newKey() {
      this.isCreateDialogShown = true
    }
  },
  apollo: {
    keys: {
      query: gql`
        {
          authentication {
            apiKeys {
              id
              name
              keyShort
              expiration
              isRevoked
              createdAt
              updatedAt
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: (data) => data.authentication.apiKeys,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-users-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
