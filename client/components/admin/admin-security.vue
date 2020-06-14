<template lang='pug'>
  v-container(fluid, grid-list-lg)
    v-layout(row wrap)
      v-flex(xs12)
        .admin-header
          img.animated.fadeInUp(src='/_assets/svg/icon-private.svg', alt='Security', style='width: 80px;')
          .admin-header-title
            .headline.primary--text.animated.fadeInLeft {{ $t('admin:security.title') }}
            .subtitle-1.grey--text.animated.fadeInLeft {{ $t('admin:security.subtitle') }}
          v-spacer
          v-btn.animated.fadeInDown(color='success', depressed, @click='save', large)
            v-icon(left) mdi-check
            span {{$t('common:actions.apply')}}
        v-form.pt-3
          v-layout(row wrap)
            v-flex(lg6 xs12)
              v-card.animated.fadeInUp
                v-toolbar(color='red darken-2', dark, dense, flat)
                  v-toolbar-title.subtitle-1 Security
                v-card-info(color='red')
                  span Make sure to understand the implications before turning on / off a security feature.
                v-card-text
                  v-switch(
                    inset
                    label='Block Open Redirect'
                    color='red darken-2'
                    v-model='config.securityOpenRedirect'
                    persistent-hint
                    hint='Prevents user controlled URLs from directing to websites outside of your wiki. This provides Open Redirect protection.'
                    )

                  v-divider.mt-3
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

                  //- v-divider.mt-3
                  //- v-switch(
                  //-   inset
                  //-   label='Subresource Integrity (SRI)'
                  //-   color='red darken-2'
                  //-   v-model='config.securitySRI'
                  //-   persistent-hint
                  //-   hint='This ensure that resources such as CSS and JS files are not altered during delivery.'
                  //-   disabled
                  //-   )

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

            v-flex(lg6 xs12)
              v-card.animated.fadeInUp.wait-p2s
                v-toolbar(color='primary', dark, dense, flat)
                  v-toolbar-title.subtitle-1 {{ $t('admin:security.uploads') }}
                v-card-info(color='blue')
                  span {{$t('admin:security.uploadsInfo')}}
                v-card-text
                  v-text-field.mt-3(
                    outlined
                    :label='$t(`admin:security.maxUploadSize`)'
                    required
                    v-model='config.uploadMaxFileSize'
                    prepend-icon='mdi-progress-upload'
                    :hint='$t(`admin:security.maxUploadSizeHint`)'
                    persistent-hint
                    :suffix='$t(`admin:security.maxUploadSizeSuffix`)'
                    style='max-width: 450px;'
                    )
                  v-text-field.mt-3(
                    outlined
                    :label='$t(`admin:security.maxUploadBatch`)'
                    required
                    v-model='config.uploadMaxFiles'
                    prepend-icon='mdi-upload-lock'
                    :hint='$t(`admin:security.maxUploadBatchHint`)'
                    persistent-hint
                    :suffix='$t(`admin:security.maxUploadBatchSuffix`)'
                    style='max-width: 450px;'
                    )

              v-card.mt-3.animated.fadeInUp.wait-p2s
                v-toolbar(flat, color='primary', dark, dense)
                  .subtitle-1 {{$t('admin:security.JWTSettings')}}
                v-card-info(color='blue')
                  span {{$t('admin:security.jwtInfo')}}
                v-card-text
                  v-text-field.md2(
                    v-model='config.jwtAudience'
                    outlined
                    prepend-icon='mdi-account-group-outline'
                    :label='$t(`admin:auth.jwtAudience`)'
                    :hint='$t(`admin:auth.jwtAudienceHint`)'
                    persistent-hint
                  )
                  v-text-field.mt-3.md2(
                    v-model='config.jwtExpiration'
                    outlined
                    prepend-icon='mdi-clock-outline'
                    :label='$t(`admin:auth.tokenExpiration`)'
                    :hint='$t(`admin:auth.tokenExpirationHint`)'
                    persistent-hint
                  )
                  v-text-field.mt-3.md2(
                    v-model='config.jwtRenewablePeriod'
                    outlined
                    prepend-icon='mdi-update'
                    :label='$t(`admin:auth.tokenRenewalPeriod`)'
                    :hint='$t(`admin:auth.tokenRenewalPeriodHint`)'
                    persistent-hint
                  )
</template>

<script>
import _ from 'lodash'
import { sync } from 'vuex-pathify'
import gql from 'graphql-tag'

export default {
  data() {
    return {
      config: {
        uploadMaxFileSize: 0,
        uploadMaxFiles: 0,
        securityOpenRedirect: true,
        securityIframe: true,
        securityReferrerPolicy: true,
        securityTrustProxy: true,
        securitySRI: true,
        securityHSTS: false,
        securityHSTSDuration: 0,
        securityCSP: false,
        securityCSPDirectives: '',
        jwtAudience: 'urn:wiki.js',
        jwtExpiration: '30m',
        jwtRenewablePeriod: '14d'
      },
      hstsDurations: [
        { value: 300, text: '5 minutes' },
        { value: 86400, text: '1 day' },
        { value: 604800, text: '1 week' },
        { value: 2592000, text: '1 month' },
        { value: 31536000, text: '1 year' },
        { value: 63072000, text: '2 years' }
      ]
    }
  },
  computed: {
    activeModal: sync('editor/activeModal')
  },
  methods: {
    async save () {
      try {
        await this.$apollo.mutate({
          mutation: gql`
            mutation (
              $uploadMaxFileSize: Int
              $uploadMaxFiles: Int
              $securityOpenRedirect: Boolean
              $securityIframe: Boolean
              $securityReferrerPolicy: Boolean
              $securityTrustProxy: Boolean
              $securitySRI: Boolean
              $securityHSTS: Boolean
              $securityHSTSDuration: Int
              $securityCSP: Boolean
              $securityCSPDirectives: String
            ) {
              site {
                updateConfig(
                  uploadMaxFileSize: $uploadMaxFileSize,
                  uploadMaxFiles: $uploadMaxFiles,
                  securityOpenRedirect: $securityOpenRedirect,
                  securityIframe: $securityIframe,
                  securityReferrerPolicy: $securityReferrerPolicy,
                  securityTrustProxy: $securityTrustProxy,
                  securitySRI: $securitySRI,
                  securityHSTS: $securityHSTS,
                  securityHSTSDuration: $securityHSTSDuration,
                  securityCSP: $securityCSP,
                  securityCSPDirectives: $securityCSPDirectives
                ) {
                  responseResult {
                    succeeded
                    errorCode
                    slug
                    message
                  }
                }
              }
            }
          `,
          variables: {
            uploadMaxFileSize: _.toSafeInteger(_.get(this.config, 'uploadMaxFileSize', 0)),
            uploadMaxFiles: _.toSafeInteger(_.get(this.config, 'uploadMaxFiles', 0)),
            securityOpenRedirect: _.get(this.config, 'securityOpenRedirect', false),
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
      } catch (err) {
        this.$store.commit('pushGraphError', err)
      }
    }
  },
  apollo: {
    config: {
      query: gql`
        {
          site {
            config {
              uploadMaxFileSize
              uploadMaxFiles
              securityOpenRedirect
              securityIframe
              securityReferrerPolicy
              securityTrustProxy
              securitySRI
              securityHSTS
              securityHSTSDuration
              securityCSP
              securityCSPDirectives
            }
          }
        }
      `,
      fetchPolicy: 'network-only',
      update: (data) => _.cloneDeep(data.site.config),
      watchLoading (isLoading) {
        this.$store.commit(`loading${isLoading ? 'Start' : 'Stop'}`, 'admin-security-refresh')
      }
    }
  }
}
</script>

<style lang='scss'>

</style>
