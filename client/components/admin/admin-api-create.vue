<template lang="pug">
  div
    v-dialog(v-model='isShown', max-width='650', persistent)
      v-card
        .dialog-header.is-short
          v-icon.mr-3(color='white') mdi-plus
          span {{$t('admin:api.newKeyTitle')}}
        v-card-text.pt-5
          v-text-field(
            outlined
            prepend-icon='mdi-format-title'
            v-model='name'
            :label='$t(`admin:api.newKeyName`)'
            persistent-hint
            ref='keyNameInput'
            :hint='$t(`admin:api.newKeyNameHint`)'
            counter='255'
            )
          v-select.mt-3(
            :items='expirations'
            outlined
            prepend-icon='mdi-clock'
            v-model='expiration'
            :label='$t(`admin:api.newKeyExpiration`)'
            :hint='$t(`admin:api.newKeyExpirationHint`)'
            persistent-hint
            )
          v-divider.mt-4
          v-subheader.pl-2: strong.indigo--text {{$t('admin:api.newKeyPermissionScopes')}}
          v-list.pl-8(nav)
            v-list-item-group(v-model='fullAccess')
              v-list-item(
                :value='true'
                active-class='indigo--text'
                )
                template(v-slot:default='{ active, toggle }')
                  v-list-item-action
                    v-checkbox(
                      :input-value='active'
                      :true-value='true'
                      color='indigo'
                      @click='toggle'
                    )
                  v-list-item-content
                    v-list-item-title {{$t('admin:api.newKeyFullAccess')}}
            v-divider.mt-3
            v-subheader.caption.indigo--text {{$t('admin:api.newKeyGroupPermissions')}}
            v-list-item
              v-select(
                :disabled='fullAccess'
                :items='groups'
                item-text='name'
                item-value='id'
                outlined
                color='indigo'
                v-model='group'
                :label='$t(`admin:api.newKeyGroup`)'
                :hint='$t(`admin:api.newKeyGroupHint`)'
                persistent-hint
                )
        v-card-chin
          v-spacer
          v-btn(text, @click='isShown = false', :disabled='loading') {{$t('common:actions.cancel')}}
          v-btn.px-3(depressed, color='primary', @click='generate', :loading='loading')
            v-icon(left) mdi-chevron-right
            span {{$t('common:actions.generate')}}

    v-dialog(
      v-model='isCopyKeyDialogShown'
      max-width='750'
      persistent
      overlay-color='blue darken-5'
      overlay-opacity='.9'
      )
      v-card
        v-toolbar(dense, flat, color='primary', dark) {{$t('admin:api.newKeyTitle')}}
        v-card-text.pt-5
          .body-2.text-center
            i18next(tag='span', path='admin:api.newKeyCopyWarn')
              strong(place='bold') {{$t('admin:api.newKeyCopyWarnBold')}}
          v-textarea.mt-3(
            ref='keyContentsIpt'
            filled
            no-resize
            readonly
            v-model='key'
            :rows='10'
            hide-details
          )
        v-card-chin
          v-spacer
          v-btn.px-3(depressed, dark, color='primary', @click='isCopyKeyDialogShown = false') {{$t('common:actions.close')}}
</template>

<script>
import _ from 'lodash'
import gql from 'graphql-tag'

import groupsQuery from 'gql/admin/users/users-query-groups.gql'

export default {
  props: {
    value: {
      type: Boolean,
      default: false
    }
  },
  data() {
    return {
      loading: false,
      name: '',
      expiration: '1y',
      fullAccess: true,
      groups: [],
      group: null,
      isCopyKeyDialogShown: false,
      key: ''
    }
  },
  computed: {
    isShown: {
      get() { return this.value },
      set(val) { this.$emit('input', val) }
    },
    expirations() {
      return [
        { value: '30d', text: this.$t('admin:api.expiration30d') },
        { value: '90d', text: this.$t('admin:api.expiration90d') },
        { value: '180d', text: this.$t('admin:api.expiration180d') },
        { value: '1y', text: this.$t('admin:api.expiration1y') },
        { value: '3y', text: this.$t('admin:api.expiration3y') }
      ]
    }
  },
  watch: {
    value (newValue, oldValue) {
      if (newValue) {
        setTimeout(() => {
          this.$refs.keyNameInput.focus()
        }, 400)
      }
    }
  },
  methods: {
    async generate () {
      try {
        if (_.trim(this.name).length < 2 || this.name.length > 255) {
          throw new Error(this.$t('admin:api.newKeyNameError'))
        } else if (!this.fullAccess && !this.group) {
          throw new Error(this.$t('admin:api.newKeyGroupError'))
        } else if (!this.fullAccess && this.group === 2) {
          throw new Error(this.$t('admin:api.newKeyGuestGroupError'))
        }
      } catch (err) {
        return this.$store.commit('showNotification', {
          style: 'red',
          message: err,
          icon: 'alert'
        })
      }

      this.loading = true

      try {
        const resp = await this.$apollo.mutate({
          mutation: gql`
            mutation ($name: String!, $expiration: String!, $fullAccess: Boolean!, $group: Int) {
              authentication {
                createApiKey (name: $name, expiration: $expiration, fullAccess: $fullAccess, group: $group) {
                  key
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
            name: this.name,
            expiration: this.expiration,
            fullAccess: (this.fullAccess === true),
            group: this.group
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-api-create')
          }
        })
        if (_.get(resp, 'data.authentication.createApiKey.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            style: 'success',
            message: this.$t('admin:api.newKeySuccess'),
            icon: 'check'
          })

          this.name = ''
          this.expiration = '1y'
          this.fullAccess = true
          this.group = null
          this.isShown = false
          this.$emit('refresh')

          this.key = _.get(resp, 'data.authentication.createApiKey.key', '???')
          this.isCopyKeyDialogShown = true

          setTimeout(() => {
            this.$refs.keyContentsIpt.$refs.input.select()
          }, 400)
        } else {
          this.$store.commit('showNotification', {
            style: 'red',
            message: _.get(resp, 'data.authentication.createApiKey.responseResult.message', 'An unexpected error occurred.'),
            icon: 'alert'
          })
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }

      this.loading = false
    }
  },
  apollo: {
    groups: {
      query: groupsQuery,
      fetchPolicy: 'network-only',
      update: (data) => data.groups.list,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-api-groups-refresh')
      }
    }
  }
}
</script>
