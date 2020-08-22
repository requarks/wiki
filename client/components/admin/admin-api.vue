<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-rest-api.svg', alt='API', style='width: 80px;')
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
          v-btn.mr-3.animated.fadeInDown.wait-p2s(outlined, color='grey', icon, @click='refresh')
            v-icon mdi-refresh
          v-btn.mr-3.animated.fadeInDown.wait-p1s(:color='enabled ? `red` : `green`', depressed, @click='globalSwitch', dark, :loading='isToggleLoading')
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
                  td
                    strong(:class='key.isRevoked ? `red--text` : ``') {{ key.name }}
                    em.caption.ml-1.red--text(v-if='key.isRevoked') (revoked)
                  td.caption {{ key.keyShort }}
                  td(:style='key.isRevoked ? `text-decoration: line-through;` : ``') {{ key.expiration | moment('LL') }}
                  td {{ key.createdAt | moment('calendar') }}
                  td {{ key.updatedAt | moment('calendar') }}
                  td: v-btn(icon, @click='revoke(key)', :disabled='key.isRevoked'): v-icon(color='error') mdi-cancel
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
import _ from 'lodash'
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
      isToggleLoading: false,
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
      this.isToggleLoading = true
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($enabled: Boolean!) {
              authentication {
                setApiState (enabled: $enabled) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                }
              }
            }
          `,
          variables: {
            enabled: !this.enabled
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-api-toggle')
          }
        })
        if (_.get(resp, 'data.authentication.setApiState.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            style: 'success',
            message: this.enabled ? this.$t('admin:api.toggleStateDisabledSuccess') : this.$t('admin:api.toggleStateEnabledSuccess'),
            icon: 'check'
          })
          await this.$apollo.queries.enabled.refetch()
        } else {
          this.$store.commit('showNotification', {
            style: 'red',
            message: _.get(resp, 'data.authentication.setApiState.responseResult.message', 'An unexpected error occurred.'),
            icon: 'alert'
          })
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.isToggleLoading = false
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
      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($id: Int!) {
              authentication {
                revokeApiKey (id: $id) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                }
              }
            }
          `,
          variables: {
            id: this.current.id
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-api-revoke')
          }
        })
        if (_.get(resp, 'data.authentication.revokeApiKey.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            style: 'success',
            message: this.$t('admin:api.revokeSuccess'),
            icon: 'check'
          })
          this.refresh(false)
        } else {
          this.$store.commit('showNotification', {
            style: 'red',
            message: _.get(resp, 'data.authentication.revokeApiKey.responseResult.message', 'An unexpected error occurred.'),
            icon: 'alert'
          })
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.isRevokeConfirmDialogShown = false
      this.revokeLoading = false
    }
  },
  apollo: {
    enabled: {
      query: gql`
        {
          authentication {
            apiState
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: (data) => data.authentication.apiState,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-api-state-refresh')
      }
    },
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
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-api-keys-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
