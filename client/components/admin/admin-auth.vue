<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img(src='/svg/icon-unlock.svg', alt='Authentication', style='width: 80px;')
          .admin-header-title
            .headline.primary--text Authentication
            .subheading.grey--text Configure the authentication settings of your wiki
          v-spacer
          v-btn(outline, color='grey', @click='refresh', large)
            v-icon refresh
          v-btn(color='primary', @click='save', depressed, large)
            v-icon(left) chevron_right
            span Apply Configuration

        v-card.mt-3
          v-tabs(color='grey darken-2', fixed-tabs, slider-color='white', show-arrows, dark)
            v-tab(key='settings'): v-icon settings
            v-tab(v-for='strategy in activeStrategies', :key='strategy.key') {{ strategy.title }}

            v-tab-item(key='settings', :transition='false', :reverse-transition='false')
                v-container.pa-3(fluid, grid-list-md)
                  v-layout(row, wrap)
                    v-flex(xs12, md6)
                      .body-2.grey--text.text--darken-1 Select which authentication strategies to enable:
                      .caption.grey--text.pb-2 Some strategies require additional configuration in their dedicated tab (when selected).
                      v-form
                        v-checkbox.my-0(
                          v-for='strategy in strategies'
                          v-model='strategy.isEnabled'
                          :key='strategy.key'
                          :label='strategy.title'
                          color='primary'
                          :disabled='strategy.key === `local`'
                          hide-details
                        )
                    v-flex(xs12, md6)
                      .pa-3.grey.radius-7(:class='$vuetify.dark ? "darken-4" : "lighten-5"')
                        .body-2.grey--text.text--darken-1 Advanced Settings
                        v-text-field.mt-3.md2(
                          v-model='jwtAudience'
                          outline
                          background-color='grey lighten-2'
                          prepend-icon='account_balance'
                          label='JWT Audience'
                          hint='Audience URN used in JWT issued upon login. Usually your domain name. (e.g. urn:your.domain.com)'
                          persistent-hint
                        )
                        v-text-field.mt-3.md2(
                          v-model='jwtExpiration'
                          outline
                          background-color='grey lighten-2'
                          prepend-icon='schedule'
                          label='Token Expiration'
                          hint='The expiration period of a token until it must be renewed. (default: 30m)'
                          persistent-hint
                        )
                        v-text-field.mt-3.md2(
                          v-model='jwtRenewablePeriod'
                          outline
                          background-color='grey lighten-2'
                          prepend-icon='update'
                          label='Token Renewal Period'
                          hint='The maximum period a token can be renewed when expired. (default: 14d)'
                          persistent-hint
                        )

            v-tab-item(v-for='(strategy, n) in activeStrategies', :key='strategy.key', :transition='false', :reverse-transition='false')
              v-card.wiki-form.pa-3(flat, tile)
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
                    v-switch.mb-3(
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
                  template(v-if='strategy.key === `local`')
                    v-divider.mt-3
                    v-subheader.pl-0 Security
                    .pr-3
                      v-switch.ml-3(
                        :disabled='true'
                        v-model='strategy.recaptcha'
                        label='Use reCAPTCHA by Google'
                        color='primary'
                        hint='Protects against spam robots and malicious registrations.'
                        persistent-hint
                      )
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
      strategies: [],
      jwtAudience: 'urn:wiki.js',
      jwtExpiration: '30m',
      jwtRenewablePeriod: '14d'
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
          ])).map(str => ({...str, config: str.config.map(cfg => ({...cfg, value: JSON.stringify({ v: cfg.value.value })}))}))
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
