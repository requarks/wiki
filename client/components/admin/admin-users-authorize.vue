<template lang="pug">
  v-dialog(v-model='isShown', max-width='550')
    v-card.wiki-form
      .dialog-header.is-short
        span Authorize Social User
        v-spacer
        v-chip(label, color='white', small).primary--text coming soon
      v-card-text
        v-alert.mb-4.deep-orange.lighten-5.radius-7(
          v-if='providers.length < 1'
          color='deep-orange'
          icon='warning'
          outline
          :value='true'
          ) You must enable at least 1 social strategy first.
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
          outline
          prepend-icon='person'
          v-model='name'
          label='Name'
          )
      v-card-chin
        v-spacer
        v-btn(flat, @click='isShown = false') Cancel
        v-btn(color='primary', @click='authorizeUser', :disabled='providers.length < 1 || true') Authorize
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
