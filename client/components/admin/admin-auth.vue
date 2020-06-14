<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row, wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-unlock.svg', alt='Authentication', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{ $t('admin:auth.title') }}
            .subtitle-1.grey--text.animated.fadeInLeft.wait-p4s {{ $t('admin:auth.subtitle') }}
          v-spacer
          v-btn.animated.fadeInDown.wait-p3s(icon, outlined, color='grey', href='https://docs.requarks.io/auth', target='_blank')
            v-icon mdi-help-circle
          v-btn.animated.fadeInDown.wait-p2s.mx-3(icon, outlined, color='grey', @click='refresh')
            v-icon mdi-refresh
          v-btn.animated.fadeInDown(color='success', @click='save', depressed, large)
            v-icon(left) mdi-check
            span {{$t('common:actions.apply')}}

      v-flex(lg3, xs12)
        v-card.animated.fadeInUp
          v-toolbar(flat, color='teal', dark, dense)
            .subtitle-1 {{$t('admin:auth.activeStrategies')}}
          v-list(two-line, dense).py-0
            draggable(
              v-model='activeStrategies'
              handle='.is-handle'
              direction='vertical'
              :store='order'
              )
              transition-group
                v-list-item(
                  v-for='(str, idx) in activeStrategies'
                  :key='str.key'
                  @click='selectedStrategy = str.key'
                  :class='selectedStrategy === str.key ? ($vuetify.theme.dark ? `grey darken-5` : `teal lighten-5`) : ``'
                  )
                  v-list-item-avatar.is-handle(size='24')
                    v-icon(:color='selectedStrategy === str.key ? `teal` : `grey`') mdi-drag-horizontal
                  v-list-item-content
                    v-list-item-title.body-2(:class='selectedStrategy === str.key ? `teal--text` : ``') {{ str.displayName }}
                    v-list-item-subtitle: .caption(:class='selectedStrategy === str.key ? `teal--text ` : ``') {{ str.strategy.title }}
                  v-list-item-avatar(v-if='selectedStrategy === str.key', size='24')
                    v-icon.animated.fadeInLeft(color='teal', large) mdi-chevron-right
          v-card-chin
            v-menu(offset-y, bottom, min-width='250px', max-width='550px', max-height='50vh', style='flex: 1 1;', center)
              template(v-slot:activator='{ on }')
                v-btn(v-on='on', color='primary', depressed, block)
                  v-icon(left) mdi-plus
                  span {{$t('admin:auth.addStrategy')}}
              v-list(dense)
                template(v-for='(str, idx) of strategies')
                  v-list-item(
                    :key='str.key'
                    :disabled='str.isDisabled'
                    @click='addStrategy(str)'
                    )
                    v-list-item-avatar(height='24', width='48', tile)
                      v-img(:src='str.logo', width='48px', height='24px', contain, :style='str.isDisabled ? `opacity: .25;` : ``')
                    v-list-item-content
                      v-list-item-title {{str.title}}
                      v-list-item-subtitle: .caption(:style='str.isDisabled ? `opacity: .4;` : ``') {{str.description}}
                  v-divider(v-if='idx < strategies.length - 1')

      v-flex(xs12, lg9)
        v-card.animated.fadeInUp.wait-p2s
          v-toolbar(color='primary', dense, flat, dark)
            .subtitle-1 {{strategy.displayName}} #[em ({{strategy.strategy.title}})]
            v-spacer
            v-btn(small, outlined, dark, color='white', :disabled='strategy.key === `local`')
              v-icon(left) mdi-close
              span {{$t('common:actions.delete')}}
          v-card-info(color='blue')
            div
              span {{strategy.strategy.description}}
              .caption: a(:href='strategy.strategy.website') {{strategy.strategy.website}}
            v-spacer
            .authlogo
              img(:src='strategy.strategy.logo', :alt='strategy.strategy.title')
          v-card-text
            .overline.mb-5 {{$t('admin:auth.strategyConfiguration')}}
            v-text-field.mb-3(
              outlined
              label='Display Name'
              v-model='strategy.displayName'
              prepend-icon='mdi-format-title'
              hint='The title shown to the end user for this authentication strategy.'
              persistent-hint
              )
            template(v-for='cfg in strategy.config')
              v-select.mb-3(
                v-if='cfg.value.type === "string" && cfg.value.enum'
                outlined
                :items='cfg.value.enum'
                :key='cfg.key'
                :label='cfg.value.title'
                v-model='cfg.value.value'
                prepend-icon='mdi-cog-box'
                :hint='cfg.value.hint ? cfg.value.hint : ""'
                persistent-hint
                :class='cfg.value.hint ? "mb-2" : ""'
                :style='cfg.value.maxWidth > 0 ? `max-width:` + cfg.value.maxWidth + `px;` : ``'
              )
              v-switch.mb-6(
                v-else-if='cfg.value.type === "boolean"'
                :key='cfg.key'
                :label='cfg.value.title'
                v-model='cfg.value.value'
                color='primary'
                prepend-icon='mdi-cog-box'
                :hint='cfg.value.hint ? cfg.value.hint : ""'
                persistent-hint
                inset
                )
              v-textarea.mb-3(
                v-else-if='cfg.value.type === "string" && cfg.value.multiline'
                outlined
                :key='cfg.key'
                :label='cfg.value.title'
                v-model='cfg.value.value'
                prepend-icon='mdi-cog-box'
                :hint='cfg.value.hint ? cfg.value.hint : ""'
                persistent-hint
                :class='cfg.value.hint ? "mb-2" : ""'
                )
              v-text-field.mb-3(
                v-else
                outlined
                :key='cfg.key'
                :label='cfg.value.title'
                v-model='cfg.value.value'
                prepend-icon='mdi-cog-box'
                :hint='cfg.value.hint ? cfg.value.hint : ""'
                persistent-hint
                :class='cfg.value.hint ? "mb-2" : ""'
                :style='cfg.value.maxWidth > 0 ? `max-width:` + cfg.value.maxWidth + `px;` : ``'
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

        v-card.mt-4.wiki-form.animated.fadeInUp.wait-p4s(v-if='selectedStrategy !== `local`')
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
import gql from 'graphql-tag'

import groupsQuery from 'gql/admin/auth/auth-query-groups.gql'
import strategiesSaveMutation from 'gql/admin/auth/auth-mutation-save-strategies.gql'
import hostQuery from 'gql/admin/auth/auth-query-host.gql'

import draggable from 'vuedraggable'

export default {
  components: {
    draggable
  },
  filters: {
    startCase(val) { return _.startCase(val) }
  },
  data() {
    return {
      groups: [],
      strategies: [],
      activeStrategies: [],
      selectedStrategy: '',
      host: '',
      strategy: {
        strategy: {}
      }
    }
  },
  computed: {
    order: {
      get () {
        return this.strategies
      },
      set (val) {

      }
    }
  },
  watch: {
    selectedStrategy(newValue, oldValue) {
      this.strategy = _.find(this.activeStrategies, ['key', newValue]) || {}
    },
    activeStrategies(newValue, oldValue) {
      this.selectedStrategy = 'local'
    }
  },
  methods: {
    async refresh() {
      await this.$apollo.queries.strategies.refetch()
      await this.$apollo.queries.activeStrategies.refetch()
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
      query: gql`
        query {
          authentication {
            strategies {
              key
              title
              description
              isAvailable
              useForm
              logo
              website
              props {
                key
                value
              }
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: (data) => _.get(data, 'authentication.strategies', []).map(str => ({
        ...str,
        isDisabled: !str.isAvailable || str.key === `local`,
        props: _.sortBy(str.props.map(cfg => ({
          key: cfg.key,
          ...JSON.parse(cfg.value)
        })), [t => t.order])
      })),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-auth-strategies-refresh')
      }
    },
    activeStrategies: {
      query: gql`
        query {
          authentication {
            activeStrategies {
              key
              strategy {
                title
                description
                useForm
                logo
                website
              }
              config {
                key
                value
              }
              order
              displayName
              selfRegistration
              domainWhitelist
              autoEnrollGroups
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: (data) => _.get(data, 'authentication.activeStrategies', []).map(str => ({
        ...str,
        config: _.sortBy(str.config.map(cfg => ({
          ...cfg,
          value: JSON.parse(cfg.value)
        })), [t => t.value.order])
      })),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-auth-activestrategies-refresh')
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
  height: 60px;
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
