<template lang="pug">
  v-dialog(v-model='isShown', max-width='650', persistent)
    v-card
      .dialog-header.is-short
        v-icon.mr-3(color='white') mdi-plus
        span New User
        v-spacer
        v-btn.mx-0(color='white', outlined, disabled, dark)
          v-icon(left) mdi-database-import
          span Bulk Import
      v-card-text.pt-5
        v-select(
          :items='providers'
          item-text='title'
          item-value='key'
          outlined
          prepend-icon='mdi-domain'
          v-model='provider'
          label='Provider'
          )
        v-text-field(
          outlined
          prepend-icon='mdi-at'
          v-model='email'
          label='Email Address'
          key='newUserEmail'
          persistent-hint
          ref='emailInput'
          )
        v-text-field(
          v-if='provider === `local`'
          outlined
          prepend-icon='mdi-lock-outline'
          append-icon='mdi-dice-5'
          v-model='password'
          :label='mustChangePwd ? `Temporary Password` : `Password`'
          counter='255'
          @click:append='generatePwd'
          key='newUserPassword'
          persistent-hint
          )
        v-text-field(
          outlined
          prepend-icon='mdi-account-outline'
          v-model='name'
          label='Name'
          :hint='provider === `local` ? `Can be changed by the user.` : `May be overwritten by the provider during login.`'
          key='newUserName'
          persistent-hint
          )
        v-select.mt-2(
          :items='groups'
          item-text='name'
          item-value='id'
          item-disabled='isSystem'
          outlined
          prepend-icon='mdi-account-group'
          v-model='group'
          label='Assign to Group(s)...'
          dense
          clearable
          multiple
          )
        v-divider
        v-checkbox(
          color='primary'
          label='Require password change on first login'
          v-if='provider === `local`'
          v-model='mustChangePwd'
          hide-details
        )
        v-checkbox(
          color='primary'
          label='Send a welcome email'
          hide-details
          v-model='sendWelcomeEmail'
          disabled
        )
      v-card-chin
        v-spacer
        v-btn(text, @click='isShown = false') Cancel
        v-btn.px-3(depressed, color='primary', @click='newUser(false)')
          v-icon(left) mdi-chevron-right
          span Create
        v-btn.px-3(depressed, color='primary', @click='newUser(true)')
          v-icon(left) mdi-chevron-double-right
          span Create and Close
</template>

<script>
import _ from 'lodash'
import validate from 'validate.js'

import createUserMutation from 'gql/admin/users/users-mutation-create.gql'
import providersQuery from 'gql/admin/users/users-query-strategies.gql'
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
      providers: [],
      provider: 'local',
      email: '',
      password: '',
      name: '',
      groups: [],
      group: [],
      mustChangePwd: false,
      sendWelcomeEmail: false
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
          this.$refs.emailInput.focus()
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
    providers: {
      query: providersQuery,
      fetchPolicy: 'network-only',
      update: (data) => data.authentication.strategies,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-users-strategies-refresh')
      }
    },
    groups: {
      query: groupsQuery,
      fetchPolicy: 'network-only',
      update: (data) => data.groups.list,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-auth-groups-refresh')
      }
    }
  }
}
</script>
