<template lang='pug'>
  v-card(tile, :color='$vuetify.dark ? "grey darken-4" : "grey lighten-5"')
    .pa-3.pt-4
      .headline.primary--text Authentication
      .subheading.grey--text Configure the authentication settings of your wiki
    v-tabs(:color='$vuetify.dark ? "primary" : "grey lighten-4"', fixed-tabs, :slider-color='$vuetify.dark ? "white" : "primary"', show-arrows)
      v-tab(key='settings'): v-icon settings
      v-tab(v-for='strategy in activeStrategies', :key='strategy.key') {{ strategy.title }}

      v-tab-item(key='settings', :transition='false', :reverse-transition='false')
        v-card.pa-3(flat, tile)
          .body-2.grey--text.text--darken-1 Select which authentication strategies to enable:
          .caption.grey--text.pb-2 Some strategies require additional configuration in their dedicated tab (when selected).
          v-form
            v-checkbox.my-1(
              v-for='strategy in strategies'
              v-model='strategy.isEnabled'
              :key='strategy.key'
              :label='strategy.title'
              color='primary'
              :disabled='strategy.key === `local`'
              hide-details
            )

      v-tab-item(v-for='(strategy, n) in activeStrategies', :key='strategy.key', :transition='false', :reverse-transition='false')
        v-card.pa-3(flat, tile)
          v-form
            .authlogo
              img(:src='strategy.logo', :alt='strategy.title')
            v-subheader.pl-0 {{strategy.title}}
            .caption {{strategy.description}}
            .caption: a(:href='strategy.website') {{strategy.website}}
            v-divider.mt-3
            v-subheader.pl-0 Strategy Configuration
            .body-1.ml-3(v-if='!strategy.config || strategy.config.length < 1') This strategy has no configuration options you can modify.
            template(v-else, v-for='cfg in strategy.config')
              v-select(
                v-if='cfg.value.type === "string" && cfg.value.enum'
                outline
                background-color='grey lighten-2'
                :items='cfg.value.enum'
                :key='cfg.key'
                :label='cfg.value.title'
                v-model='cfg.value.value'
                prepend-icon='settings_applications'
                :hint='cfg.value.hint ? cfg.value.hint : ""'
                persistent-hint
                :class='cfg.value.hint ? "mb-2" : ""'
              )
              v-switch(
                v-else-if='cfg.value.type === "boolean"'
                :key='cfg.key'
                :label='cfg.value.title'
                v-model='cfg.value.value'
                color='primary'
                prepend-icon='settings_applications'
                :hint='cfg.value.hint ? cfg.value.hint : ""'
                persistent-hint
                )
              v-text-field(
                v-else
                outline
                background-color='grey lighten-2'
                :key='cfg.key'
                :label='cfg.value.title'
                v-model='cfg.value.value'
                prepend-icon='settings_applications'
                :hint='cfg.value.hint ? cfg.value.hint : ""'
                persistent-hint
                :class='cfg.value.hint ? "mb-2" : ""'
                )
            v-divider.mt-3
            v-subheader.pl-0 Registration
            .pr-3
              v-switch.ml-3(
                v-model='strategy.selfRegistration'
                label='Allow self-registration'
                color='primary'
                hint='Allow any user successfully authorized by the strategy to access the wiki.'
                persistent-hint
              )
              v-combobox.ml-3.mt-3(
                label='Limit to specific email domains'
                v-model='strategy.domainWhitelist'
                prepend-icon='mail_outline'
                outline
                background-color='grey lighten-2'
                persistent-hint
                deletable-chips
                clearable
                multiple
                chips
                )
              v-autocomplete.ml-3(
                outline
                background-color='grey lighten-2'
                :items='groups'
                item-text='name'
                item-value='id'
                label='Assign to group'
                v-model='strategy.autoEnrollGroups'
                prepend-icon='people'
                hint='Automatically assign new users to these groups.'
                persistent-hint
                deletable-chips
                clearable
                multiple
                chips
                )

    v-card-chin
      v-btn(color='primary', @click='save')
        v-icon(left) chevron_right
        span Apply Configuration
      v-spacer
      v-btn(icon, @click='refresh')
        v-icon.grey--text refresh

</template>

<script>
import _ from 'lodash'

import groupsQuery from 'gql/admin/auth/auth-query-groups.gql'
import strategiesQuery from 'gql/admin/auth/auth-query-strategies.gql'
import strategiesSaveMutation from 'gql/admin/auth/auth-mutation-save-strategies.gql'

export default {
  filters: {
    startCase(val) { return _.startCase(val) }
  },
  data() {
    return {
      groups: [],
      strategies: []
    }
  },
  computed: {
    activeStrategies() {
      return _.filter(this.strategies, 'isEnabled')
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
    async save() {
      this.$store.commit(`loadingStart`, 'admin-auth-savestrategies')
      await this.$apollo.mutate({
        mutation: strategiesSaveMutation,
        variables: {
          strategies: this.strategies.map(str => _.pick(str, [
            'isEnabled',
            'key',
            'config',
            'selfRegistration',
            'domainWhitelist',
            'autoEnrollGroups'
          ])).map(str => ({...str, config: str.config.map(cfg => ({...cfg, value: cfg.value.value}))}))
        }
      })
      this.$store.commit('showNotification', {
        message: 'Authentication configuration saved successfully.',
        style: 'success',
        icon: 'check'
      })
      this.$store.commit(`loadingStop`, 'admin-auth-savestrategies')
    }
  },
  apollo: {
    strategies: {
      query: strategiesQuery,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.authentication.strategies).map(str => ({...str, config: str.config.map(cfg => ({...cfg, value: JSON.parse(cfg.value)}))})),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-auth-refresh')
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

<style lang='scss' scoped>

.authlogo {
  width: 250px;
  height: 85px;
  float:right;
  display: flex;
  justify-content: flex-end;
  align-items: center;

  img {
    max-width: 100%;
    max-height: 50px;
  }
}

</style>
