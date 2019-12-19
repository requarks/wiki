<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-validation.svg', alt='SSL', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{ $t('admin:ssl.title') }}
            .subtitle-1.grey--text.animated.fadeInLeft {{ $t('admin:ssl.subtitle') }}
          v-spacer
          v-btn.animated.fadeInDown(color='success', depressed, @click='save', large)
            v-icon(left) mdi-check
            span {{$t('common:actions.apply')}}
        v-form.pt-3
          v-layout(row wrap)
            v-flex(lg6 xs12)
              v-form
                v-card.animated.fadeInUp
                  v-toolbar(color='primary', dark, dense, flat)
                    v-toolbar-title.subtitle-1 {{ $t('admin:ssl.provider') }}
                  v-card-text
                    v-select(
                      :items='providers'
                      outlined
                      :label='$t(`admin:ssl.provider`)'
                      required
                      :counter='255'
                      v-model='config.provider'
                      prepend-icon='mdi-handshake'
                      :hint='$t(`admin:ssl.providerHint`)'
                      persistent-hint
                      )
                    v-text-field.mt-3(
                      outlined
                      :label='$t(`admin:ssl.domain`)'
                      required
                      :counter='255'
                      v-model='config.domain'
                      prepend-icon='mdi-earth'
                      :hint='$t(`admin:ssl.domainHint`)'
                      persistent-hint
                      :disabled='config.provider === ``'
                      )

              v-card.animated.fadeInUp.wait-p2s.mt-3(v-if='config.provider !== ``')
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title.subtitle-1 {{$t('admin:ssl.providerOptions')}}
                v-card-text ---

            v-flex(lg6 xs12)
              v-card.animated.fadeInUp.wait-p2s
                  v-toolbar(color='primary', dark, dense, flat)
                    v-toolbar-title.subtitle-1 {{ $t('admin:ssl.ports') }}
                  v-card-text
                    v-row
                      v-col(cols='6')
                        v-text-field(
                          outlined
                          :label='$t(`admin:ssl.httpPort`)'
                          v-model='config.httpPort'
                          prepend-icon='mdi-lock-open-variant-outline'
                          :hint='$t(`admin:ssl.httpPortHint`)'
                          persistent-hint
                          )
                      v-col(cols='6')
                        v-checkbox(
                          :label='$t(`admin:ssl.httpPortRedirect`)'
                          v-model='config.httpRedirect'
                          :hint='$t(`admin:ssl.httpPortRedirectHint`)'
                          :disabled='config.provider === ``'
                          persistent-hint
                          color='primary'
                          )
                      v-col(cols='6')
                        v-text-field(
                          outlined
                          :label='$t(`admin:ssl.httpsPort`)'
                          v-model='config.httpsPort'
                          prepend-icon='mdi-lock'
                          :hint='$t(`admin:ssl.httpsPortHint`)'
                          persistent-hint
                          :disabled='config.provider === ``'
                          )
                  v-card-text.grey(:class='$vuetify.theme.dark ? `darken-4-l5` : `lighten-4`')
                    .caption {{$t(`admin:ssl.writableConfigFileWarning`)}}

</template>

<script>
import _ from 'lodash'
import siteConfigQuery from 'gql/admin/site/site-query-config.gql'
import siteUpdateConfigMutation from 'gql/admin/site/site-mutation-save-config.gql'

export default {
  data() {
    return {
      config: {
        provider: '',
        domain: '',
        httpPort: 3000,
        httpPortRedirect: true,
        httpsPort: 443
      }
    }
  },
  computed: {
    providers () {
      return [
        { text: this.$t('admin:ssl.providerDisabled'), value: '' },
        { text: this.$t('admin:ssl.providerLetsEncrypt'), value: 'letsencrypt' },
        { text: this.$t('admin:ssl.providerCustomCertificate'), value: 'custom' }
      ]
    }
  },
  methods: {
    async save () {
      try {
        await this.$apollo.mutate({
          mutation: siteUpdateConfigMutation,
          variables: {
            host: _.get(this.config, 'host', ''),
            title: _.get(this.config, 'title', ''),
            description: _.get(this.config, 'description', ''),
            robots: _.get(this.config, 'robots', []),
            analyticsService: _.get(this.config, 'analyticsService', ''),
            analyticsId: _.get(this.config, 'analyticsId', ''),
            company: _.get(this.config, 'company', ''),
            hasLogo: _.get(this.config, 'hasLogo', false),
            logoIsSquare: _.get(this.config, 'logoIsSquare', false),
            featurePageRatings: _.get(this.config, 'featurePageRatings', false),
            featurePageComments: _.get(this.config, 'featurePageComments', false),
            featurePersonalWikis: _.get(this.config, 'featurePersonalWikis', false),
            securityIframe: _.get(this.config, 'securityIframe', false),
            securityReferrerPolicy: _.get(this.config, 'securityReferrerPolicy', false),
            securityTrustProxy: _.get(this.config, 'securityTrustProxy', false),
            securitySRI: _.get(this.config, 'securitySRI', false),
            securityHSTS: _.get(this.config, 'securityHSTS', false),
            securityHSTSDuration: _.get(this.config, 'securityHSTSDuration', 0),
            securityCSP: _.get(this.config, 'securityCSP', false),
            securityCSPDirectives: _.get(this.config, 'securityCSPDirectives', '')
          },
          watchLoading (isLoading) {
            this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-site-update')
          }
        })
        this.$store.commit('showNotification', {
          style: 'success',
          message: 'Configuration saved successfully.',
          icon: 'check'
        })
        this.siteTitle = this.config.title
        this.company = this.config.company
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    }
  }
  // apollo: {
  //   config: {
  //     query: siteConfigQuery,
  //     fetchPolicy: 'network-only',
  //     update: (data) => _.cloneDeep(data.site.config),
  //     watchLoading (isLoading) {
  //       this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-site-refresh')
  //     }
  //   }
  // }
}
</script>

<style lang='scss'>

</style>
