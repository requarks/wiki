<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-unlock.svg', alt='Authentication', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{ $t('admin:auth.title') }}
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p4s {{ $t('admin:auth.subtitle') }}
          v-spacer
          v-btn.animated.fadeInDown.wait-p2s.mr-3(outlined, color='grey', @click='refresh', large)
            v-icon mdi-refresh
          v-btn.animated.fadeInDown(color='success', @click='save', depressed, large)
            v-icon(left) mdi-check
            span {{$t('common:actions.apply')}}

      v-flex(lg3, xs12)
        v-card.animated.fadeInUp
          v-toolbar(flat, color='primary', dark, dense)
            .subtitle-1 {{$t('admin:auth.strategies')}}
          v-list(two-line, dense).py-0
            template(v-for='(str, idx) in strategies')
              v-list-item(:key='str.key', @click='selectedStrategy = str.key', :disabled='!str.isAvailable')
                v-list-item-avatar(size='24')
                  v-icon(color='grey', v-if='!str.isAvailable') mdi-minus-box-outline
                  v-icon(color='primary', v-else-if='str.isEnabled && str.key !== `local`', v-ripple, @click='str.isEnabled = false') mdi-checkbox-marked-outline
                  v-icon(color='primary', v-else-if='str.isEnabled && str.key === `local`') mdi-checkbox-marked-outline
                  v-icon(color='grey', v-else, v-ripple, @click='str.isEnabled = true') mdi-checkbox-blank-outline
                v-list-item-content
                  v-list-item-title.body-2(:class='!str.isAvailable ? `grey--text` : (selectedStrategy === str.key ? `primary--text` : ``)') {{ str.title }}
                  v-list-item-subtitle: .caption(:class='!str.isAvailable ? `grey--text text--lighten-1` : (selectedStrategy === str.key ? `blue--text ` : ``)') {{ str.description }}
                v-list-item-avatar(v-if='selectedStrategy === str.key', size='24')
                  v-icon.animated.fadeInLeft(color='primary', large) mdi-chevron-right
              v-divider(v-if='idx < strategies.length - 1')

        v-card.mt-3.animated.fadeInUp.wait-p2s
          v-toolbar(flat, color='primary', dark, dense)
            .subtitle-1 {{$t('admin:auth.globalAdvSettings')}}
          v-card-text
            v-text-field.md2(
              v-model='jwtAudience'
              outlined
              prepend-icon='mdi-account-group-outline'
              :label='$t(`admin:auth.jwtAudience`)'
              :hint='$t(`admin:auth.jwtAudienceHint`)'
              persistent-hint
            )
            v-text-field.mt-3.md2(
              v-model='jwtExpiration'
              outlined
              prepend-icon='mdi-clock-outline'
              :label='$t(`admin:auth.tokenExpiration`)'
              :hint='$t(`admin:auth.tokenExpirationHint`)'
              persistent-hint
            )
            v-text-field.mt-3.md2(
              v-model='jwtRenewablePeriod'
              outlined
              prepend-icon='mdi-update'
              :label='$t(`admin:auth.tokenRenewalPeriod`)'
              :hint='$t(`admin:auth.tokenRenewalPeriodHint`)'
              persistent-hint
            )

      v-flex(xs12, lg9)
        v-card.animated.fadeInUp.wait-p2s
          v-toolbar(color='primary', dense, flat, dark)
            .subtitle-1 {{strategy.title}}
            v-spacer
            v-switch(
              dark
              color='blue lighten-5'
              label='Active'
              v-model='strategy.isEnabled'
              hide-details
              inset
              :disabled='strategy.key === `local`'
              )
          v-card-text
            v-form
              .authlogo
                img(:src='strategy.logo', :alt='strategy.title')
              .body-2.pt-3 {{strategy.description}}
              .body-2.pt-3.pb-5: a(:href='strategy.website') {{strategy.website}}
              i18next.body-2(path='admin:auth.strategyState', tag='div', v-if='strategy.isEnabled')
                v-chip(color='green', small, dark, label, place='state') {{$t('admin:auth.strategyStateActive')}}
                span(v-if='selectedStrategy === `local`', place='locked') {{$t('admin:auth.strategyStateLocked')}}
                span(v-else, place='locked', v-text='')
              i18next.body-2(path='admin:auth.strategyState', tag='div', v-else)
                v-chip(color='red', small, dark, label, place='state') {{$t('admin:auth.strategyStateInactive')}}
              v-divider.mt-3
              .overline.my-5 {{$t('admin:auth.strategyConfiguration')}}
              .body-2.ml-3(v-if='!strategy.config || strategy.config.length < 1'): em {{$t('admin:auth.strategyNoConfiguration')}}
              template(v-else, v-for='cfg in strategy.config')
                v-select(
                  v-if='cfg.value.type === "string" && cfg.value.enum'
                  outlined
                  :items='cfg.value.enum'
                  :key='cfg.key'
                  :label='cfg.value.title'
                  v-model='cfg.value.value'
                  prepend-icon='mdi-settings-box'
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
                  prepend-icon='mdi-settings-box'
                  :hint='cfg.value.hint ? cfg.value.hint : ""'
                  persistent-hint
                  inset
                  )
                v-textarea(
                  v-else-if='cfg.value.type === "string" && cfg.value.multiline'
                  outlined
                  :key='cfg.key'
                  :label='cfg.value.title'
                  v-model='cfg.value.value'
                  prepend-icon='mdi-settings-box'
                  :hint='cfg.value.hint ? cfg.value.hint : ""'
                  persistent-hint
                  :class='cfg.value.hint ? "mb-2" : ""'
                  )
                v-text-field(
                  v-else
                  outlined
                  :key='cfg.key'
                  :label='cfg.value.title'
                  v-model='cfg.value.value'
                  prepend-icon='mdi-settings-box'
                  :hint='cfg.value.hint ? cfg.value.hint : ""'
                  persistent-hint
                  :class='cfg.value.hint ? "mb-2" : ""'
                  )
              v-divider.mt-3
              .overline.my-5 {{$t('admin:auth.registration')}}
              .pr-3
                v-switch.ml-3(
                  v-model='strategy.selfRegistration'
                  :label='$t(`admin:auth.selfRegistration`)'
                  color='primary'
                  :hint='$t(`admin:auth.selfRegistrationHint`)'
                  persistent-hint
                  inset
                )
                v-combobox.ml-3.mt-3(
                  :label='$t(`admin:auth.domainsWhitelist`)'
                  v-model='strategy.domainWhitelist'
                  prepend-icon='mdi-email-check-outline'
                  outlined
                  :disabled='!strategy.selfRegistration'
                  :hint='$t(`admin:auth.domainsWhitelistHint`)'
                  persistent-hint
                  small-chips
                  deletable-chips
                  clearable
                  multiple
                  chips
                  )
                v-autocomplete.mt-3.ml-3(
                  outlined
                  :disabled='!strategy.selfRegistration'
                  :items='groups'
                  item-text='name'
                  item-value='id'
                  :label='$t(`admin:auth.autoEnrollGroups`)'
                  v-model='strategy.autoEnrollGroups'
                  prepend-icon='mdi-account-group'
                  :hint='$t(`admin:auth.autoEnrollGroupsHint`)'
                  small-chips
                  persistent-hint
                  deletable-chips
                  clearable
                  multiple
                  chips
                  )
              template(v-if='strategy.useForm')
                v-divider.mt-3
                .d-flex.my-5.align-center
                  .overline {{$t('admin:auth.security')}}
                  v-chip.ml-3.grey--text(outlined, small, label) Coming soon
                v-switch.ml-3(
                  v-if='strategy.key === `local`'
                  :disabled='!strategy.selfRegistration || true'
                  v-model='strategy.recaptcha'
                  label='Use reCAPTCHA by Google'
                  color='primary'
                  hint='Protects against spam robots and malicious registrations.'
                  persistent-hint
                  inset
                )
                v-switch.ml-3(
                  v-model='strategy.recaptcha'
                  :disabled='true'
                  :label='$t(`admin:auth.force2fa`)'
                  color='primary'
                  :hint='$t(`admin:auth.force2faHint`)'
                  persistent-hint
                  inset
                )

        v-card.mt-4.wiki-form.animated.fadeInUp.wait-p4s
          v-toolbar(color='primary', dense, flat, dark)
            .subtitle-1 {{$t('admin:auth.configReference')}}
          v-card-text
            .body-2 {{$t('admin:auth.configReferenceSubtitle')}}
            v-alert.mt-3.radius-7(v-if='host.length < 8', color='red', outlined, :value='true', icon='mdi-alert')
              i18next(path='admin:auth.siteUrlNotSetup', tag='span')
                strong(place='siteUrl') {{$t('admin:general.siteUrl')}}
                strong(place='general') {{$t('admin:general.title')}}
            .pa-3.mt-3.radius-7.grey(v-else, :class='$vuetify.theme.dark ? `darken-3-d5` : `lighten-3`')
              .body-2: strong {{$t('admin:auth.allowedWebOrigins')}}
              .body-2 {{host}}
              v-divider.my-3
              .body-2: strong {{$t('admin:auth.callbackUrl')}}
              .body-2 {{host}}/login/{{strategy.key}}/callback
              v-divider.my-3
              .body-2: strong {{$t('admin:auth.loginUrl')}}
              .body-2 {{host}}/login
              v-divider.my-3
              .body-2: strong {{$t('admin:auth.logoutUrl')}}
              .body-2 {{host}}
              v-divider.my-3
              .body-2: strong {{$t('admin:auth.tokenEndpointAuthMethod')}}
              .body-2 HTTP-POST
</template>

<script>
import _ from 'lodash'

import groupsQuery from 'gql/admin/auth/auth-query-groups.gql'
import strategiesQuery from 'gql/admin/auth/auth-query-strategies.gql'
import strategiesSaveMutation from 'gql/admin/auth/auth-mutation-save-strategies.gql'
import hostQuery from 'gql/admin/auth/auth-query-host.gql'

export default {
  filters: {
    startCase(val) { return _.startCase(val) }
  },
  data() {
    return {
      groups: [],
      strategies: [],
      selectedStrategy: '',
      host: '',
      strategy: {},
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
  watch: {
    selectedStrategy(newValue, oldValue) {
      this.strategy = _.find(this.strategies, ['key', newValue]) || {}
    },
    strategies(newValue, oldValue) {
      this.selectedStrategy = 'local'
    }
  },
  methods: {
    async refresh() {
      await this.$apollo.queries.strategies.refetch()
      this.$store.commit('showNotification', {
        message: this.$t('admin:auth.refreshSuccess'),
        style: 'success',
        icon: 'cached'
      })
    },
    async save() {
      this.$store.commit(`loadingStart`, 'admin-auth-savestrategies')
      try {
        await this.$apollo.mutate({
          mutation: strategiesSaveMutation,
          variables: {
            config: {
              audience: this.jwtAudience,
              tokenExpiration: this.jwtExpiration,
              tokenRenewal: this.jwtRenewablePeriod
            },
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
          message: this.$t('admin:auth.saveSuccess'),
          style: 'success',
          icon: 'check'
        })
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
      this.$store.commit(`loadingStop`, 'admin-auth-savestrategies')
    }
  },
  apollo: {
    strategies: {
      query: strategiesQuery,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.authentication.strategies).map(str => ({
        ...str,
        config: _.sortBy(str.config.map(cfg => ({
          ...cfg,
          value: JSON.parse(cfg.value)
        })), [t => t.value.order])
      })),
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
    },
    host: {
      query: hostQuery,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.site.config.host),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-auth-host-refresh')
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
  margin-left: 16px;

  img {
    max-width: 100%;
    max-height: 50px;
  }
}

</style>
