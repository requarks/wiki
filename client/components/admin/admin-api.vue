<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-rest-api.svg', alt='API', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{$t('admin:api.title')}}
            .subtitle-1.grey--text.animated.fadeInLeft {{$t('admin:api.subtitle')}}
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
          v-btn.mr-3.animated.fadeInDown.wait-p1s(:color='enabled ? `red` : `green`', depressed, large, @click='globalSwitch', dark)
            v-icon(left) mdi-power
            span(v-if='!enabled') {{$t('admin:api.enableButton')}}
            span(v-else) {{$t('admin:api.disableButton')}}
          v-btn.animated.fadeInDown(color='primary', depressed, large, @click='newKey', dark)
            v-icon(left) mdi-plus
            span {{$t('admin:api.newKeyButton')}}
        v-card.mt-3.animated.fadeInUp
          v-simple-table(v-if='keys && keys.length > 0')
            template(v-slot:default)
              thead
                tr.grey(:class='$vuetify.theme.dark ? `darken-4-d5` : `lighten-5`')
                  th {{$t('admin:api.headerName')}}
                  th {{$t('admin:api.headerKeyEnding')}}
                  th {{$t('admin:api.headerExpiration')}}
                  th {{$t('admin:api.headerCreated')}}
                  th {{$t('admin:api.headerLastUpdated')}}
                  th(width='100') {{$t('admin:api.headerRevoke')}}
              tbody
                tr(v-for='key of keys', :key='`key-` + key.id')
                  td: strong {{ key.name }}
                  td.caption {{ key.keyShort }}
                  td {{ key.expiration | moment('calendar') }}
                  td {{ key.createdAt | moment('calendar') }}
                  td {{ key.updatedAt | moment('calendar') }}
                  td: v-btn(icon, @click='revoke(key)'): v-icon(color='error') mdi-cancel
          v-card-text(v-else)
            v-alert.mb-0(icon='mdi-information', :value='true', outlined, color='info') {{$t('admin:api.noKeyInfo')}}

    create-api-key(v-model='isCreateDialogShown', @refresh='refresh(false)')

    v-dialog(v-model='isRevokeConfirmDialogShown', max-width='500', persistent)
      v-card
        .dialog-header.is-red {{$t('admin:api.revokeConfirm')}}
        v-card-text.pa-4
          i18next(tag='span', path='admin:api.revokeConfirmText')
            strong(place='name') {{ current.name }}
        v-card-actions
          v-spacer
          v-btn(text, @click='isRevokeConfirmDialogShown = false', :disabled='revokeLoading') {{$t('common:actions.cancel')}}
          v-btn(color='red', dark, @click='revokeConfirm', :loading='revokeLoading') {{$t('admin:api.revoke')}}
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
      isCreateDialogShown: false,
      isRevokeConfirmDialogShown: false,
      revokeLoading: false,
      current: {}
    }
  },
  methods: {
    async refresh (notify = true) {
      this.$apollo.queries.keys.refetch()
      if (notify) {
        this.$store.commit('showNotification', {
          message: this.$t('admin:api.refreshSuccess'),
          style: 'success',
          icon: 'cached'
        })
      }
    },
    async globalSwitch () {

    },
    async newKey () {
      this.isCreateDialogShown = true
    },
    revoke (key) {
      this.current = key
      this.isRevokeConfirmDialogShown = true
    },
    async revokeConfirm () {
      this.revokeLoading = true
      this.$store.commit('showNotification', {
        message: this.$t('admin:api.revokeSuccess'),
        style: 'success',
        icon: 'cached'
      })
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
