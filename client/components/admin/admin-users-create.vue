<template lang="pug">
  v-dialog(v-model='isShown', max-width='650', persistent)
    v-card.wiki-form
      .dialog-header.is-short
        v-icon.mr-3(color='white') mdi-plus
        span New User
        v-spacer
        v-btn.mx-0(color='white', outlined, disabled, dark)
          v-icon(left) mdi-database-import
          span Bulk Import
      v-card-text
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
          v-validate='{ required: true, email: true, min: 2, max: 255 }',
          data-vv-name='email',
          data-vv-as='Email Address',
          data-vv-scope='newUser',
          :error-messages='errors.collect(`newUser.email`)'
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
          v-validate='{ required: true, min: 6, max: 255 }',
          data-vv-name='password',
          data-vv-as='Password',
          data-vv-scope='newUser',
          :error-messages='errors.collect(`newUser.password`)'
          key='newUserPassword'
          persistent-hint
          )
        v-text-field(
          outlined
          prepend-icon='mdi-account-outline'
          v-model='name'
          label='Name'
          v-validate='{ required: true, min: 2, max: 255 }',
          data-vv-name='name',
          data-vv-as='Name',
          data-vv-scope='newUser',
          :error-messages='errors.collect(`newUser.name`)'
          key='newUserName'
          persistent-hint
          )
        v-select(
          :items='groups'
          item-text='name'
          item-value='key'
          outlined
          prepend-icon='mdi-account-group'
          v-model='group'
          label='Assign to Group(s)...'
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
        )
      v-card-chin
        v-spacer
        v-btn(text, @click='isShown = false') Cancel
        v-btn(depressed, color='primary', @click='newUser(false)', :disabled='errors.any(`newUser`)') Create
        v-btn(depressed, color='primary', @click='newUser(true)', :disabled='errors.any(`newUser`)') Create and Close
</template>

<script>
import _ from 'lodash'

import createUserMutation from 'gql/admin/users/users-mutation-create.gql'
import providersQuery from 'gql/admin/users/users-query-strategies.gql'
import groupsQuery from 'gql/admin/auth/auth-query-groups.gql'

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
      group: '',
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
        this.$validator.reset()
        this.$nextTick(() => {
          this.$refs.emailInput.focus()
        })
      }
    },
    provider(newValue, oldValue) {
      this.$validator.reset()
    }
  },
  methods: {
    async newUser(close = false) {
      const validationSuccess = await this.$validator.validateAll('newUser')
      if (!validationSuccess) {
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
            groups: this.groups,
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
          } else {
            this.$refs.emailInput.focus()
          }
        } else {
          this.$store.commit('showNotification', {
            style: 'red',
            message: _.get(resp, 'data.users.create.responseResult.message', 'An unexpected error occured.'),
            icon: 'warning'
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
