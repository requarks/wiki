<template lang="pug">
  v-dialog(v-model='isShown', max-width='550')
    v-card.wiki-form
      .dialog-header.is-short
        span New User
      v-card-text
        v-select.md2(
          :items='providers'
          item-text='title'
          item-value='key'
          outline
          prepend-icon='business'
          v-model='provider'
          label='Provider'
          )
        v-text-field.md2(
          outline
          prepend-icon='email'
          v-model='email'
          label='Email Address'
          ref='emailInput'
          )
        v-text-field.md2(
          v-if='provider === `local`'
          outline
          prepend-icon='lock'
          append-icon='casino'
          v-model='password'
          label='Password'
          counter='255'
          @click:append='generatePwd'
          )
        v-text-field.md2(
          outline
          prepend-icon='person'
          v-model='name'
          label='Name'
          )
      v-card-chin
        v-spacer
        v-btn(flat, @click='isShown = false') Cancel
        v-btn(color='primary', @click='newUser') Create
</template>

<script>
import _ from 'lodash'
import uuidv4 from 'uuid/v4'

import providersQuery from 'gql/admin/users/users-query-strategies.gql'

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
      name: ''
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
    }
  }
}
</script>
