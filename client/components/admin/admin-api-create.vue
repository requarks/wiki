<template lang="pug">
  div
    v-dialog(v-model='isShown', max-width='650', persistent)
      v-card
        .dialog-header.is-short
          v-icon.mr-3(color='white') mdi-plus
          span New API Key
        v-card-text.pt-5
          v-text-field(
            outlined
            prepend-icon='mdi-format-title'
            v-model='name'
            label='Name'
            persistent-hint
            ref='keyNameInput'
            hint='Purpose of this key'
            counter='255'
            )
          v-select.mt-3(
            :items='expirations'
            outlined
            prepend-icon='mdi-clock'
            v-model='expiration'
            label='Expiration'
            hint='You can still revoke a key anytime regardless of the expiration.'
            persistent-hint
            )
          v-divider.mt-4
          v-subheader.pl-2: strong.indigo--text Permission Scopes
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
                    v-list-item-title Full Access
            v-divider.mt-3
            v-subheader.caption.indigo--text or use group permissions...
            v-list-item
              v-select(
                :disabled='fullAccess'
                :items='groups'
                item-text='name'
                item-value='id'
                outlined
                color='indigo'
                v-model='group'
                label='Group'
                hint='The API key will have the same permissions as the selected group.'
                persistent-hint
                )
        v-card-chin
          v-spacer
          v-btn(text, @click='isShown = false', :disabled='loading') Cancel
          v-btn.px-3(depressed, color='primary', @click='generate', :loading='loading')
            v-icon(left) mdi-chevron-right
            span Generate

    v-dialog(
      v-model='isCopyKeyDialogShown'
      max-width='750'
      persistent
      overlay-color='blue darken-5'
      overlay-opacity='.9'
      )
      v-card
        v-toolbar(dense, flat, color='primary', dark) API Key
        v-card-text.pt-5
          .body-2.text-center Copy the key shown below as #[strong it will not be shown again].
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
          v-btn.px-3(depressed, dark, color='primary', @click='isCopyKeyDialogShown = false') Close
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
      expirations: [
        { value: '30d', text: '30 days' },
        { value: '90d', text: '90 days' },
        { value: '180d', text: '180 days' },
        { value: '1y', text: '1 year' },
        { value: '3y', text: '3 years' }
      ],
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
    }
  },
  watch: {
    value(newValue, oldValue) {
      if (newValue) {
        this.$nextTick(() => {
          this.$refs.keyNameInput.focus()
        })
      }
    }
  },
  methods: {
    async generate () {
      try {
        if (_.trim(this.name).length < 2 || this.name.length > 255) {
          throw new Error('Name is missing or invalid.')
        } else if (!this.fullAccess && !this.group) {
          throw new Error('You must select a group.')
        } else if (!this.fullAccess && this.group === 2) {
          throw new Error('The guests group cannot be used for API keys.')
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
            mutation ($name: String!, $expiration: String!, $fullAccess: Boolean!, $group: String) {
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
            fullAccess: this.fullAccess,
            group: this.group
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-api-create')
          }
        })
        if (_.get(resp, 'data.authentication.createApiKey.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            style: 'success',
            message: 'API key created successfully.',
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
            message: _.get(resp, 'data.authentication.createApiKey.responseResult.message', 'An unexpected error occured.'),
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
