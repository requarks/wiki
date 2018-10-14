<template lang="pug">
  v-dialog(v-model='isShown', max-width='550')
    v-card
      .dialog-header.is-short Authorize Social User
      v-card-text
        v-select.md2(
          :items='providers'
          item-text='title'
          item-value='key'
          solo
          flat
          background-color='grey lighten-4'
          prepend-icon='business'
          v-model='provider'
          label='Provider'
          )
        v-text-field.md2(
          solo
          flat
          background-color='grey lighten-4'
          prepend-icon='email'
          v-model='email'
          label='Email Address'
          ref='emailInput'
          )
        v-text-field.md2(
          solo
          flat
          background-color='grey lighten-4'
          prepend-icon='person'
          v-model='name'
          label='Name'
          )
        v-text-field.md2(
          solo
          flat
          background-color='grey lighten-4'
          prepend-icon='title'
          v-model='jobTitle'
          label='Job Title'
          counter='255'
          hint='Optional'
          persistent-hint
          )
        v-text-field.md2(
          solo
          flat
          background-color='grey lighten-4'
          prepend-icon='public'
          v-model='location'
          label='Location'
          counter='255'
          hint='Optional'
          persistent-hint
          )
      v-card-chin
        v-spacer
        v-btn(flat, @click='isShown = false') Cancel
        v-btn(color='primary', @click='authorizeUser') Authorize
</template>

<script>
import _ from 'lodash'

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
      provider: '',
      email: '',
      name: '',
      jobTitle: '',
      location: ''
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
    async authorizeUser() {

    }
  },
  apollo: {
    providers: {
      query: providersQuery,
      fetchPolicy: 'network-only',
      update: (data) => _.reject(data.authentication.strategies, ['key', 'local']),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-users-strategies-refresh')
      }
    }
  }
}
</script>
