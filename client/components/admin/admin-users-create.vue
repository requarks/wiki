<template lang="pug">
  v-dialog(v-model='isShown', max-width='650', persistent)
    v-card.wiki-form
      .dialog-header.is-short
        span New User
      v-card-text
        v-select(
          :items='providers'
          item-text='title'
          item-value='key'
          outline
          prepend-icon='business'
          v-model='provider'
          label='Provider'
          )
        v-text-field(
          outline
          prepend-icon='email'
          v-model='email'
          label='Email Address'
          ref='emailInput'
          )
        v-text-field(
          v-if='provider === `local`'
          outline
          prepend-icon='lock'
          append-icon='casino'
          v-model='password'
          :label='mustChangePwd ? `Temporary Password` : `Password`'
          counter='255'
          @click:append='generatePwd'
          )
        v-text-field(
          outline
          prepend-icon='person'
          v-model='name'
          label='Name'
          )
        v-select(
          :items='groups'
          item-text='name'
          item-value='key'
          outline
          prepend-icon='people'
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
        v-btn(flat, @click='isShown = false') Cancel
        v-btn(color='primary', @click='newUser') Create
        v-btn(color='primary', @click='newUser') Create and Close
</template>

<script>
import uuidv4 from 'uuid/v4'

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
        this.$nextTick(() => {
          this.$refs.emailInput.focus()
        })
      }
    }
  },
  methods: {
    async newUser() {

    },
    generatePwd() {
      this.password = uuidv4().slice(-12)
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
