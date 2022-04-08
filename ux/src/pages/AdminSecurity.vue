<template lang='pug'>
q-page.admin-mail
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-protect.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ $t('admin.security.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ $t('admin.security.subtitle') }}
    .col-auto
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        href='https://docs.js.wiki/admin/security'
        target='_blank'
        type='a'
        )
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='loading > 0'
        @click='load'
        )
      q-btn(
        unelevated
        icon='mdi-check'
        :label='$t(`common.actions.apply`)'
        color='secondary'
        @click='save'
        :loading='loading > 0'
      )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-12.col-lg-6
      //- -----------------------
      //- Security
      //- -----------------------
      q-card.shadow-1.q-pb-sm
        q-card-section
          .text-subtitle1 {{$t('admin.security.title')}}
        q-item.q-pt-none
          q-item-section
            q-card.bg-negative.text-white.rounded-borders(flat)
              q-card-section.items-center(horizontal)
                q-card-section.col-auto.q-pr-none
                  q-icon(name='las la-exclamation-triangle', size='sm')
                q-card-section.text-caption {{ $t('admin.security.warn') }}
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='rfid-signal')
          q-item-section
            q-item-label {{$t(`admin.security.disallowFloc`)}}
            q-item-label(caption) {{$t(`admin.security.disallowFlocHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='config.disallowFloc'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='$t(`admin.security.disallowFloc`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='maximize-window')
          q-item-section
            q-item-label {{$t(`admin.security.disallowIframe`)}}
            q-item-label(caption) {{$t(`admin.security.disallowIframeHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='config.disallowIframe'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='$t(`admin.security.disallowIframe`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='do-not-touch')
          q-item-section
            q-item-label {{$t(`admin.security.enforceSameOriginReferrerPolicy`)}}
            q-item-label(caption) {{$t(`admin.security.enforceSameOriginReferrerPolicyHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='config.enforceSameOriginReferrerPolicy'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='$t(`admin.security.enforceSameOriginReferrerPolicy`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='curly-arrow')
          q-item-section
            q-item-label {{$t(`admin.security.disallowOpenRedirect`)}}
            q-item-label(caption) {{$t(`admin.security.disallowOpenRedirectHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='config.disallowOpenRedirect'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='$t(`admin.security.disallowOpenRedirect`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='download-from-cloud')
          q-item-section
            q-item-label {{$t(`admin.security.forceAssetDownload`)}}
            q-item-label(caption) {{$t(`admin.security.forceAssetDownloadHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='config.forceAssetDownload'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='$t(`admin.security.forceAssetDownload`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='door-sensor-alarmed')
          q-item-section
            q-item-label {{$t(`admin.security.trustProxy`)}}
            q-item-label(caption) {{$t(`admin.security.trustProxyHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='config.trustProxy'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='$t(`admin.security.trustProxy`)'
              )
      //- -----------------------
      //- HSTS
      //- -----------------------
      q-card.shadow-1.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{$t('admin.security.hsts')}}
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='hips')
          q-item-section
            q-item-label {{$t(`admin.security.enforceHsts`)}}
            q-item-label(caption) {{$t(`admin.security.enforceHstsHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='config.enforceHsts'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='$t(`admin.security.enforceHsts`)'
              )
        template(v-if='config.enforceHsts')
          q-separator.q-my-sm(inset)
          q-item
            blueprint-icon(icon='timer')
            q-item-section
              q-item-label {{$t(`admin.security.hstsDuration`)}}
              q-item-label(caption) {{$t(`admin.security.hstsDurationHint`)}}
            q-item-section(style='flex: 0 0 200px;')
              q-select(
                outlined
                v-model='config.hstsDuration'
                :options='hstsDurations'
                option-value='value'
                option-label='text'
                emit-value
                map-options
                dense
                :aria-label='$t(`admin.security.hstsDuration`)'
                )

    .col-12.col-lg-6
      //- -----------------------
      //- Uploads
      //- -----------------------
      q-card.shadow-1.q-pb-sm
        q-card-section
          .text-subtitle1 {{$t('admin.security.uploads')}}
        q-item.q-pt-none
          q-item-section
            q-card.bg-info.text-white.rounded-borders(flat)
              q-card-section.items-center(horizontal)
                q-card-section.col-auto.q-pr-none
                  q-icon(name='las la-info-circle', size='sm')
                q-card-section.text-caption {{ $t('admin.security.uploadsInfo') }}
        q-item
          blueprint-icon(icon='upload-to-the-cloud')
          q-item-section
            q-item-label {{$t(`admin.security.maxUploadSize`)}}
            q-item-label(caption) {{$t(`admin.security.maxUploadSizeHint`)}}
          q-item-section(style='flex: 0 0 200px;')
            q-input(
              outlined
              v-model.number='humanUploadMaxFileSize'
              dense
              :aria-label='$t(`admin.security.maxUploadSize`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='upload-to-ftp')
          q-item-section
            q-item-label {{$t(`admin.security.maxUploadBatch`)}}
            q-item-label(caption) {{$t(`admin.security.maxUploadBatchHint`)}}
          q-item-section(style='flex: 0 0 200px;')
            q-input(
              outlined
              v-model.number='config.uploadMaxFiles'
              dense
              :suffix='$t(`admin.security.maxUploadBatchSuffix`)'
              :aria-label='$t(`admin.security.maxUploadBatch`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='scan-stock')
          q-item-section
            q-item-label {{$t(`admin.security.scanSVG`)}}
            q-item-label(caption) {{$t(`admin.security.scanSVGHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='config.uploadScanSVG'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='$t(`admin.security.scanSVG`)'
              )

      //- -----------------------
      //- CORS
      //- -----------------------
      q-card.shadow-1.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{$t('admin.security.cors')}}
        q-item
          blueprint-icon(icon='firewall')
          q-item-section
            q-item-label {{$t(`admin.security.corsMode`)}}
            q-item-label(caption) {{$t(`admin.security.corsModeHint`)}}
          q-item-section
            q-select(
              outlined
              v-model='config.corsMode'
              :options='corsModes'
              option-value='value'
              option-label='text'
              emit-value
              map-options
              dense
              :aria-label='$t(`admin.security.corsMode`)'
              )
        template(v-if='config.corsMode === `HOSTNAMES`')
          q-separator.q-my-sm(inset)
          q-item
            blueprint-icon(icon='todo-list', key='corsHostnames')
            q-item-section
              q-item-label {{$t(`admin.security.corsHostnames`)}}
              q-item-label(caption) {{$t(`admin.security.corsHostnamesHint`)}}
            q-item-section
              q-input(
                outlined
                v-model='config.corsConfig'
                dense
                type='textarea'
                :aria-label='$t(`admin.security.corsHostnames`)'
                )
        template(v-else-if='config.corsMode === `REGEX`')
          q-separator.q-my-sm(inset)
          q-item
            blueprint-icon(icon='validation', key='corsRegex')
            q-item-section
              q-item-label {{$t(`admin.security.corsRegex`)}}
              q-item-label(caption) {{$t(`admin.security.corsRegexHint`)}}
            q-item-section
              q-input(
                outlined
                v-model='config.corsConfig'
                dense
                :aria-label='$t(`admin.security.corsRegex`)'
                )

      //- -----------------------
      //- JWT
      //- -----------------------
      q-card.shadow-1.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{$t('admin.security.jwt')}}
        q-item
          blueprint-icon(icon='ticket')
          q-item-section
            q-item-label {{$t(`admin.security.jwtAudience`)}}
            q-item-label(caption) {{$t(`admin.security.jwtAudienceHint`)}}
          q-item-section(style='flex: 0 0 250px;')
            q-input(
              outlined
              v-model='config.authJwtAudience'
              dense
              :aria-label='$t(`admin.security.jwtAudience`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='expired')
          q-item-section
            q-item-label {{$t(`admin.security.tokenExpiration`)}}
            q-item-label(caption) {{$t(`admin.security.tokenExpirationHint`)}}
          q-item-section(style='flex: 0 0 140px;')
            q-input(
              outlined
              v-model='config.authJwtExpiration'
              dense
              :aria-label='$t(`admin.security.tokenExpiration`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='future')
          q-item-section
            q-item-label {{$t(`admin.security.tokenRenewalPeriod`)}}
            q-item-label(caption) {{$t(`admin.security.tokenRenewalPeriodHint`)}}
          q-item-section(style='flex: 0 0 140px;')
            q-input(
              outlined
              v-model='config.authJwtRenewablePeriod'
              dense
              :aria-label='$t(`admin.security.tokenRenewalPeriod`)'
              )
</template>

<script>
import cloneDeep from 'lodash/cloneDeep'
import gql from 'graphql-tag'
import _get from 'lodash/get'
import filesize from 'filesize'
import filesizeParser from 'filesize-parser'
import { createMetaMixin } from 'quasar'

export default {
  mixins: [
    createMetaMixin(function () {
      return {
        title: this.$t('admin.security.title')
      }
    })
  ],
  data () {
    return {
      loading: false,
      config: {
        corsConfig: '',
        corsMode: 'OFF',
        cspDirectives: '',
        disallowFloc: false,
        disallowIframe: false,
        disallowOpenRedirect: false,
        enforceCsp: false,
        enforceHsts: false,
        enforceSameOriginReferrerPolicy: false,
        forceAssetDownload: false,
        hstsDuration: 0,
        trustProxy: false,
        authJwtAudience: 'urn:wiki.js',
        authJwtExpiration: '30m',
        authJwtRenewablePeriod: '14d',
        uploadMaxFileSize: 0,
        uploadMaxFiles: 0,
        uploadScanSVG: false
      },
      humanUploadMaxFileSize: '0',
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
    corsModes () {
      return [
        { value: 'OFF', text: 'Off / Same-Origin' },
        { value: 'REFLECT', text: 'Reflect Request Origin' },
        { value: 'HOSTNAMES', text: 'Hostnames Whitelist' },
        { value: 'REGEX', text: 'Regex Pattern Match' }
      ]
    }
  },
  mounted () {
    this.load()
  },
  methods: {
    async load () {
      this.loading++
      this.$q.loading.show()
      const resp = await this.$apollo.query({
        query: gql`
          query getSecurityConfig {
            systemSecurity {
              authJwtAudience
              authJwtExpiration
              authJwtRenewablePeriod
              corsConfig
              corsMode
              cspDirectives
              disallowFloc
              disallowIframe
              disallowOpenRedirect
              enforceCsp
              enforceHsts
              enforceSameOriginReferrerPolicy
              forceAssetDownload
              hstsDuration
              trustProxy
              uploadMaxFileSize
              uploadMaxFiles
              uploadScanSVG
            }
          }
        `,
        fetchPolicy: 'network-only'
      })
      this.config = cloneDeep(resp?.data?.systemSecurity)
      this.humanUploadMaxFileSize = filesize(this.config.uploadMaxFileSize ?? 0, { base: 2, standard: 'jedec' })
      this.$q.loading.hide()
      this.loading--
    },
    async save () {
      this.loading = true
      try {
        const respRaw = await this.$apollo.mutate({
          mutation: gql`
            mutation saveSecurityConfig (
              $authJwtAudience: String
              $authJwtExpiration: String
              $authJwtRenewablePeriod: String
              $corsConfig: String
              $corsMode: SystemSecurityCorsMode
              $cspDirectives: String
              $disallowFloc: Boolean
              $disallowIframe: Boolean
              $disallowOpenRedirect: Boolean
              $enforceCsp: Boolean
              $enforceHsts: Boolean
              $enforceSameOriginReferrerPolicy: Boolean
              $hstsDuration: Int
              $trustProxy: Boolean
              $uploadMaxFiles: Int
              $uploadMaxFileSize: Int
            ) {
              updateSystemSecurity(
                authJwtAudience: $authJwtAudience
                authJwtExpiration: $authJwtExpiration
                authJwtRenewablePeriod: $authJwtRenewablePeriod
                corsConfig: $corsConfig
                corsMode: $corsMode
                cspDirectives: $cspDirectives
                disallowFloc: $disallowFloc
                disallowIframe: $disallowIframe
                disallowOpenRedirect: $disallowOpenRedirect
                enforceCsp: $enforceCsp
                enforceHsts: $enforceHsts
                enforceSameOriginReferrerPolicy: $enforceSameOriginReferrerPolicy
                hstsDuration: $hstsDuration
                trustProxy: $trustProxy
                uploadMaxFiles: $uploadMaxFiles
                uploadMaxFileSize: $uploadMaxFileSize
              ) {
                status {
                  succeeded
                  slug
                  message
                }
              }
            }
          `,
          variables: {
            ...this.config,
            uploadMaxFileSize: filesizeParser(this.humanUploadMaxFileSize || '0')
          }
        })
        const resp = _get(respRaw, 'data.updateSystemSecurity.status', {})
        if (resp.succeeded) {
          this.$q.notify({
            type: 'positive',
            message: this.$t('admin.security.saveSuccess')
          })
        } else {
          throw new Error(resp.message)
        }
      } catch (err) {
        this.$q.notify({
          type: 'negative',
          message: 'Failed to save security config',
          caption: err.message
        })
      }
      this.loading = false
    }
  }
}
</script>

<style lang='scss'>

</style>
