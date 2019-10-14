<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/svg/icon-categorize.svg', alt='General', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{ $t('admin:general.title') }}
            .subtitle-1.grey--text.animated.fadeInLeft {{ $t('admin:general.subtitle') }}
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
                    v-toolbar-title.subtitle-1 {{ $t('admin:general.siteInfo') }}
                  .overline.grey--text.pa-4 {{$t('admin:general.general')}}
                  .px-3.pb-3
                    v-text-field(
                      outlined
                      :label='$t(`admin:general.siteUrl`)'
                      required
                      :counter='255'
                      v-model='config.host'
                      prepend-icon='mdi-label-variant-outline'
                      :hint='$t(`admin:general.siteUrlHint`)'
                      persistent-hint
                      )
                    v-text-field.mt-3(
                      outlined
                      :label='$t(`admin:general.siteTitle`)'
                      required
                      :counter='50'
                      v-model='config.title'
                      prepend-icon='mdi-earth'
                      :hint='$t(`admin:general.siteTitleHint`)'
                      persistent-hint
                      )
                  v-divider
                  .overline.grey--text.pa-4 {{$t('admin:general.logo')}} #[v-chip.ml-2(label, color='grey', small, outlined) coming soon]
                  v-card-text.pb-4.pl-5
                    v-layout.px-3(row, align-center)
                      v-avatar(size='100', :color='$vuetify.theme.dark ? `grey darken-2` : `grey lighten-3`', :tile='config.logoIsSquare')
                      .ml-4
                        v-btn.mr-3(color='teal', depressed, disabled)
                          v-icon(left) mdi-cloud-upload
                          span {{$t('admin:general.uploadLogo')}}
                        v-btn(color='teal', depressed, disabled)
                          v-icon(left) mdi-close
                          span {{$t('admin:general.uploadClear')}}
                        .caption.mt-3.grey--text {{$t('admin:general.uploadSizeHint', { size: '120x120' })}}
                        .caption.grey--text {{$t('admin:general.uploadTypesHint', { typeList: 'SVG, PNG', lastType: 'JPG' })}}.
                  v-divider
                  .overline.grey--text.pa-4 {{$t('admin:general.footerCopyright')}}
                  .px-3.pb-3
                    v-text-field(
                      outlined
                      :label='$t(`admin:general.companyName`)'
                      v-model='config.company'
                      :counter='255'
                      prepend-icon='mdi-domain'
                      persistent-hint
                      :hint='$t(`admin:general.companyNameHint`)'
                      )
                  v-divider
                  .overline.grey--text.pa-4 SEO
                  .px-3.pb-3
                    v-text-field(
                      outlined
                      :label='$t(`admin:general.siteDescription`)'
                      :counter='255'
                      v-model='config.description'
                      prepend-icon='mdi-compass'
                      :hint='$t(`admin:general.siteDescriptionHint`)'
                      persistent-hint
                      )
                    v-select.mt-3(
                      outlined
                      :label='$t(`admin:general.metaRobots`)'
                      multiple
                      :items='metaRobots'
                      v-model='config.robots'
                      prepend-icon='mdi-compass'
                      :return-object='false'
                      :hint='$t(`admin:general.metaRobotsHint`)'
                      persistent-hint
                      )

            v-flex(lg6 xs12)
              v-card.animated.fadeInUp.wait-p4s
                v-toolbar(color='indigo', dark, dense, flat)
                  v-toolbar-title.subtitle-1 Features
                  v-spacer
                  v-chip(label, color='white', small).indigo--text coming soon
                v-card-text
                  v-switch(
                    inset
                    label='Asset Image Optimization'
                    color='indigo'
                    v-model='config.featureTinyPNG'
                    persistent-hint
                    hint='Image optimization tool to reduce filesize and bandwidth costs.'
                    disabled
                    )
                  v-text-field.mt-3(
                    outlined
                    label='TinyPNG API Key'
                    :counter='255'
                    v-model='config.description'
                    prepend-icon='mdi-subdirectory-arrow-right'
                    hint='Get your API key at https://tinypng.com/developers'
                    persistent-hint
                    disabled
                    )

                  v-divider.mt-3
                  v-switch(
                    inset
                    label='Page Ratings'
                    color='indigo'
                    v-model='config.featurePageRatings'
                    persistent-hint
                    hint='Allow users to rate pages.'
                    disabled
                    )

                  v-divider.mt-3
                  v-switch(
                    inset
                    label='Page Comments'
                    color='indigo'
                    v-model='config.featurePageComments'
                    persistent-hint
                    hint='Allow users to leave comments on pages.'
                    disabled
                    )

                  v-divider.mt-3
                  v-switch(
                    inset
                    label='Personal Wikis'
                    color='indigo'
                    v-model='config.featurePersonalWikis'
                    persistent-hint
                    hint='Allow users to have their own personal wiki.'
                    disabled
                    )

              v-card.mt-5.animated.fadeInUp.wait-p5s
                v-toolbar(color='red darken-2', dark, dense, flat)
                  v-toolbar-title.subtitle-1 Security
                v-card-text
                  v-alert(outlined, color='red darken-2', icon='mdi-information-outline').body-2 Make sure to understand the implications before turning on / off a security feature.
                  v-switch.mt-3(
                    inset
                    label='Block IFrame Embedding'
                    color='red darken-2'
                    v-model='config.securityIframe'
                    persistent-hint
                    hint='Prevents other websites from embedding your wiki in an iframe. This provides clickjacking protection.'
                    )

                  v-divider.mt-3
                  v-switch(
                    inset
                    label='Same Origin Referrer Policy'
                    color='red darken-2'
                    v-model='config.securityReferrerPolicy'
                    persistent-hint
                    hint='Limits the referrer header to same origin.'
                    )

                  v-divider.mt-3
                  v-switch(
                    inset
                    label='Trust X-Forwarded-* Proxy Headers'
                    color='red darken-2'
                    v-model='config.securityTrustProxy'
                    persistent-hint
                    hint='Should be enabled when using a reverse-proxy like nginx, apache, CloudFlare, etc in front of Wiki.js. Turn off otherwise.'
                    )

                  v-divider.mt-3
                  v-switch(
                    inset
                    label='Subresource Integrity (SRI)'
                    color='red darken-2'
                    v-model='config.securitySRI'
                    persistent-hint
                    hint='This ensure that resources such as CSS and JS files are not altered during delivery.'
                    )

                  v-divider.mt-3
                  v-switch(
                    inset
                    label='Enforce HSTS'
                    color='red darken-2'
                    v-model='config.securityHSTS'
                    persistent-hint
                    hint='This ensures the connection cannot be established through an insecure HTTP connection.'
                    )
                  v-select.mt-5(
                    outlined
                    label='HSTS Max Age'
                    :items='hstsDurations'
                    v-model='config.securityHSTSDuration'
                    prepend-icon='mdi-subdirectory-arrow-right'
                    :disabled='!config.securityHSTS'
                    hide-details
                    style='max-width: 450px;'
                    )
                  .pl-11.mt-3
                    .caption Defines the duration for which the server should only deliver content through HTTPS.
                    .caption It's a good idea to start with small values and make sure that nothing breaks on your wiki before moving to longer values.

                  v-divider.mt-3
                  v-switch(
                    inset
                    label='Enforce CSP'
                    color='red darken-2'
                    v-model='config.securityCSP'
                    persistent-hint
                    hint='Restricts scripts to pre-approved content sources.'
                    disabled
                    )
                  v-textarea.mt-5(
                    label='CSP Directives'
                    outlined
                    v-model='config.securityCSPDirectives'
                    prepend-icon='mdi-subdirectory-arrow-right'
                    persistent-hint
                    hint='One directive per line.'
                    disabled
                  )

</template>

<script>
import _ from 'lodash'
import { get, sync } from 'vuex-pathify'
import siteConfigQuery from 'gql/admin/site/site-query-config.gql'
import siteUpdateConfigMutation from 'gql/admin/site/site-mutation-save-config.gql'

export default {
  data() {
    return {
      analyticsServices: [
        { text: 'None', value: '' },
        { text: 'Elasticsearch APM RUM', value: 'elk' },
        { text: 'Google Analytics', value: 'ga' },
        { text: 'Google Tag Manager', value: 'gtm' }
      ],
      config: {
        host: '',
        title: '',
        description: '',
        robots: [],
        analyticsService: '',
        analyticsId: '',
        company: '',
        hasLogo: false,
        logoIsSquare: false,
        featureAnalytics: false,
        featurePageRatings: false,
        featurePageComments: false,
        featurePersonalWikis: false,
        featureTinyPNG: false,
        securityIframe: true,
        securityReferrerPolicy: true,
        securityTrustProxy: true,
        securitySRI: true,
        securityHSTS: false,
        securityHSTSDuration: 0,
        securityCSP: false,
        securityCSPDirectives: ''
      },
      hstsDurations: [
        { value: 300, text: '5 minutes' },
        { value: 86400, text: '1 day' },
        { value: 604800, text: '1 week' },
        { value: 2592000, text: '1 month' },
        { value: 31536000, text: '1 year' },
        { value: 63072000, text: '2 years' }
      ],
      metaRobots: [
        { text: 'Index', value: 'index' },
        { text: 'Follow', value: 'follow' },
        { text: 'No Index', value: 'noindex' },
        { text: 'No Follow', value: 'nofollow' }
      ]
    }
  },
  computed: {
    darkMode: get('site/dark'),
    siteTitle: sync('site/title'),
    company: sync('site/company')
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
  },
  apollo: {
    config: {
      query: siteConfigQuery,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.site.config),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-site-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
