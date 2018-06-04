<template lang='pug'>
  v-card(tile, color='grey lighten-5')
    .pa-3.pt-4
      .headline.primary--text Authentication
      .subheading.grey--text Configure the authentication settings of your wiki
    v-tabs(color='grey lighten-4', fixed-tabs, slider-color='primary', show-arrows)
      v-tab(key='settings'): v-icon settings
      v-tab(v-for='strategy in activeStrategies', :key='strategy.key') {{ strategy.title }}

      v-tab-item(key='settings', :transition='false', :reverse-transition='false')
        v-card.pa-3(flat, tile)
          v-subheader.pl-0.pb-2 Select which authentication strategies to enable:
          v-form
            v-checkbox(
              v-for='strategy in strategies',
              v-model='selectedStrategies',
              :key='strategy.key',
              :label='strategy.title',
              :value='strategy.key',
              color='primary',
              :disabled='strategy.key === `local`'
              hide-details
            )

      v-tab-item(v-for='(strategy, n) in activeStrategies', :key='strategy.key', :transition='false', :reverse-transition='false')
        v-card.pa-3(flat, tile)
          v-form
            v-subheader.pl-0 Strategy Configuration
            .body-1.ml-3(v-if='!strategy.config || strategy.config.length < 1') This strategy has no configuration options you can modify.
            v-text-field(v-else, v-for='cfg in strategy.config', :key='cfg.key', :label='cfg.key', prepend-icon='settings_applications')
            v-divider
            v-subheader.pl-0 Registration
            v-switch.ml-3(
              v-model='auths',
              label='Allow self-registration',
              :value='true',
              color='primary',
              hint='Allow any user successfully authorized by the strategy to access the wiki.',
              persistent-hint
            )
            v-text-field.ml-3(label='Limit to specific email domains', prepend-icon='mail_outline')
            v-text-field.ml-3(label='Assign to group', prepend-icon='people')

    v-divider.my-0
    v-card-actions.grey.lighten-4
      v-btn(color='primary')
        v-icon(left) chevron_right
        span Save
      v-spacer
      v-btn(icon, @click='refresh')
        v-icon.grey--text refresh

</template>

<script>
import _ from 'lodash'

import strategiesQuery from 'gql/admin-auth-query-strategies.gql'
import strategiesSaveMutation from 'gql/admin-auth-mutation-save-strategies.gql'

export default {
  data() {
    return {
      strategies: [],
      selectedStrategies: ['local']
    }
  },
  computed: {
    activeStrategies() {
      return _.filter(this.strategies, prv => _.includes(this.selectedStrategies, prv.key))
    }
  },
  methods: {
    async refresh() {
      await this.$apollo.queries.strategies.refetch()
      this.$store.commit('showNotification', {
        message: 'List of strategies has been refreshed.',
        style: 'success',
        icon: 'cached'
      })
    },
    async saveProviders() {
      this.$store.commit(`loadingStart`, 'admin-auth-savestrategies')
      await this.$apollo.mutate({
        mutation: strategiesSaveMutation,
        variables: {
          strategies: this.auths
        }
      })
      this.$store.commit(`loadingStop`, 'admin-auth-savestrategies')
    }
  },
  apollo: {
    strategies: {
      query: strategiesQuery,
      fetchPolicy: 'network-only',
      update: (data) => data.authentication.strategies,
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-auth-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
