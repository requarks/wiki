<template lang="pug">
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
        v-btn(text, @click='isShown = false') Cancel
        v-btn.px-3(depressed, color='primary', @click='newUser(false)')
          v-icon(left) mdi-chevron-right
          span Generate
</template>

<script>
import _ from 'lodash'
import validate from 'validate.js'

import createUserMutation from 'gql/admin/users/users-mutation-create.gql'
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
      name: '',
      expiration: '1y',
      expirations: [
        { value: '30d', text: '30 days' },
        { value: '90d', text: '90 days' },
        { value: '6m', text: '6 months' },
        { value: '1y', text: '1 year' },
        { value: '3y', text: '3 years' }
      ],
      fullAccess: true,
      groups: [],
      group: null
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
    async newUser(close = false) {
      let rules = {
        email: {
          presence: {
            allowEmpty: false
          },
          email: true
        },
        name: {
          presence: {
            allowEmpty: false
          },
          length: {
            minimum: 2,
            maximum: 255
          }
        }
      }
      if (this.provider === `local`) {
        rules.password = {
          presence: {
            allowEmpty: false
          },
          length: {
            minimum: 6,
            maximum: 255
          }
        }
      }
      const validationResults = validate({
        email: this.email,
        password: this.password,
        name: this.name
      }, rules, { format: 'flat' })

      if (validationResults) {
        this.$store.commit('showNotification', {
          style: 'red',
          message: validationResults[0],
          icon: 'alert'
        })
        return
      }

      try {
        const resp = await this.$apollo.mutate({
          mutation: createUserMutation,
          variables: {
            providerKey: this.provider,
            email: this.email,
            passwordRaw: this.password,
            name: this.name,
            groups: this.group,
            mustChangePassword: this.mustChangePwd,
            sendWelcomeEmail: this.sendWelcomeEmail
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-users-create')
          }
        })
        if (_.get(resp, 'data.users.create.responseResult.succeeded', false)) {
          this.$store.commit('showNotification', {
            style: 'success',
            message: 'New user created successfully.',
            icon: 'check'
          })

          this.email = ''
          this.password = ''
          this.name = ''

          if (close) {
            this.isShown = false
            this.$emit('refresh')
          } else {
            this.$refs.emailInput.focus()
          }
        } else {
          this.$store.commit('showNotification', {
            style: 'red',
            message: _.get(resp, 'data.users.create.responseResult.message', 'An unexpected error occured.'),
            icon: 'alert'
          })
        }
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    },
    generatePwd() {
      const pwdChars = 'abcdefghkmnpqrstuvwxyzABCDEFHJKLMNPQRSTUVWXYZ23456789_*=?#!()+'
      this.password = _.sampleSize(pwdChars, 12).join('')
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
