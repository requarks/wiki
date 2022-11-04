<template lang='pug'>
q-page.admin-mail
  .row.q-pa-md.items-center
    .col-auto
      img.admin-icon.animated.fadeInLeft(src='/_assets/icons/fluent-protect.svg')
    .col.q-pl-md
      .text-h5.text-primary.animated.fadeInLeft {{ t('admin.security.title') }}
      .text-subtitle1.text-grey.animated.fadeInLeft.wait-p2s {{ t('admin.security.subtitle') }}
    .col-auto
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-question-circle'
        flat
        color='grey'
        :href='siteStore.docsBase + `/system/security`'
        target='_blank'
        type='a'
        )
      q-btn.q-mr-sm.acrylic-btn(
        icon='las la-redo-alt'
        flat
        color='secondary'
        :loading='state.loading > 0'
        @click='load'
        )
      q-btn(
        unelevated
        icon='fa-solid fa-check'
        :label='t(`common.actions.apply`)'
        color='secondary'
        @click='save'
        :loading='state.loading > 0'
      )
  q-separator(inset)
  .row.q-pa-md.q-col-gutter-md
    .col-12.col-lg-6
      //- -----------------------
      //- Security
      //- -----------------------
      q-card.shadow-1.q-pb-sm
        q-card-section
          .text-subtitle1 {{t('admin.security.title')}}
        q-item.q-pt-none
          q-item-section
            q-card.bg-negative.text-white.rounded-borders(flat)
              q-card-section.items-center(horizontal)
                q-card-section.col-auto.q-pr-none
                  q-icon(name='las la-exclamation-triangle', size='sm')
                q-card-section.text-caption {{ t('admin.security.warn') }}
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='rfid-signal')
          q-item-section
            q-item-label {{t(`admin.security.disallowFloc`)}}
            q-item-label(caption) {{t(`admin.security.disallowFlocHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.disallowFloc'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.security.disallowFloc`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='maximize-window')
          q-item-section
            q-item-label {{t(`admin.security.disallowIframe`)}}
            q-item-label(caption) {{t(`admin.security.disallowIframeHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.disallowIframe'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.security.disallowIframe`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='do-not-touch')
          q-item-section
            q-item-label {{t(`admin.security.enforceSameOriginReferrerPolicy`)}}
            q-item-label(caption) {{t(`admin.security.enforceSameOriginReferrerPolicyHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.enforceSameOriginReferrerPolicy'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.security.enforceSameOriginReferrerPolicy`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='curly-arrow')
          q-item-section
            q-item-label {{t(`admin.security.disallowOpenRedirect`)}}
            q-item-label(caption) {{t(`admin.security.disallowOpenRedirectHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.disallowOpenRedirect'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.security.disallowOpenRedirect`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='download-from-cloud')
          q-item-section
            q-item-label {{t(`admin.security.forceAssetDownload`)}}
            q-item-label(caption) {{t(`admin.security.forceAssetDownloadHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.forceAssetDownload'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.security.forceAssetDownload`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='door-sensor-alarmed')
          q-item-section
            q-item-label {{t(`admin.security.trustProxy`)}}
            q-item-label(caption) {{t(`admin.security.trustProxyHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.trustProxy'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.security.trustProxy`)'
              )
      //- -----------------------
      //- HSTS
      //- -----------------------
      q-card.shadow-1.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{t('admin.security.hsts')}}
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='hips')
          q-item-section
            q-item-label {{t(`admin.security.enforceHsts`)}}
            q-item-label(caption) {{t(`admin.security.enforceHstsHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.enforceHsts'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.security.enforceHsts`)'
              )
        template(v-if='state.config.enforceHsts')
          q-separator.q-my-sm(inset)
          q-item
            blueprint-icon(icon='timer')
            q-item-section
              q-item-label {{t(`admin.security.hstsDuration`)}}
              q-item-label(caption) {{t(`admin.security.hstsDurationHint`)}}
            q-item-section(style='flex: 0 0 200px;')
              q-select(
                outlined
                v-model='state.config.hstsDuration'
                :options='hstsDurations'
                option-value='value'
                option-label='text'
                emit-value
                map-options
                dense
                :aria-label='t(`admin.security.hstsDuration`)'
                )

    .col-12.col-lg-6
      //- -----------------------
      //- Uploads
      //- -----------------------
      q-card.shadow-1.q-pb-sm
        q-card-section
          .text-subtitle1 {{t('admin.security.uploads')}}
        q-item.q-pt-none
          q-item-section
            q-card.bg-info.text-white.rounded-borders(flat)
              q-card-section.items-center(horizontal)
                q-card-section.col-auto.q-pr-none
                  q-icon(name='las la-info-circle', size='sm')
                q-card-section.text-caption {{ t('admin.security.uploadsInfo') }}
        q-item
          blueprint-icon(icon='upload-to-the-cloud')
          q-item-section
            q-item-label {{t(`admin.security.maxUploadSize`)}}
            q-item-label(caption) {{t(`admin.security.maxUploadSizeHint`)}}
          q-item-section(style='flex: 0 0 200px;')
            q-input(
              outlined
              v-model.number='state.humanUploadMaxFileSize'
              dense
              :aria-label='t(`admin.security.maxUploadSize`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='upload-to-ftp')
          q-item-section
            q-item-label {{t(`admin.security.maxUploadBatch`)}}
            q-item-label(caption) {{t(`admin.security.maxUploadBatchHint`)}}
          q-item-section(style='flex: 0 0 200px;')
            q-input(
              outlined
              v-model.number='state.config.uploadMaxFiles'
              dense
              :suffix='t(`admin.security.maxUploadBatchSuffix`)'
              :aria-label='t(`admin.security.maxUploadBatch`)'
              )
        q-separator.q-my-sm(inset)
        q-item(tag='label', v-ripple)
          blueprint-icon(icon='scan-stock')
          q-item-section
            q-item-label {{t(`admin.security.scanSVG`)}}
            q-item-label(caption) {{t(`admin.security.scanSVGHint`)}}
          q-item-section(avatar)
            q-toggle(
              v-model='state.config.uploadScanSVG'
              color='primary'
              checked-icon='las la-check'
              unchecked-icon='las la-times'
              :aria-label='t(`admin.security.scanSVG`)'
              )

      //- -----------------------
      //- CORS
      //- -----------------------
      q-card.shadow-1.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{t('admin.security.cors')}}
        q-item
          blueprint-icon(icon='firewall')
          q-item-section
            q-item-label {{t(`admin.security.corsMode`)}}
            q-item-label(caption) {{t(`admin.security.corsModeHint`)}}
          q-item-section
            q-select(
              outlined
              v-model='state.config.corsMode'
              :options='corsModes'
              option-value='value'
              option-label='text'
              emit-value
              map-options
              dense
              :aria-label='t(`admin.security.corsMode`)'
              )
        template(v-if='state.config.corsMode === `HOSTNAMES`')
          q-separator.q-my-sm(inset)
          q-item
            blueprint-icon(icon='todo-list', key='corsHostnames')
            q-item-section
              q-item-label {{t(`admin.security.corsHostnames`)}}
              q-item-label(caption) {{t(`admin.security.corsHostnamesHint`)}}
            q-item-section
              q-input(
                outlined
                v-model='state.config.corsConfig'
                dense
                type='textarea'
                :aria-label='t(`admin.security.corsHostnames`)'
                )
        template(v-else-if='state.config.corsMode === `REGEX`')
          q-separator.q-my-sm(inset)
          q-item
            blueprint-icon(icon='validation', key='corsRegex')
            q-item-section
              q-item-label {{t(`admin.security.corsRegex`)}}
              q-item-label(caption) {{t(`admin.security.corsRegexHint`)}}
            q-item-section
              q-input(
                outlined
                v-model='state.config.corsConfig'
                dense
                :aria-label='t(`admin.security.corsRegex`)'
                )

      //- -----------------------
      //- JWT
      //- -----------------------
      q-card.shadow-1.q-pb-sm.q-mt-md
        q-card-section
          .text-subtitle1 {{t('admin.security.jwt')}}
        q-item
          blueprint-icon(icon='ticket')
          q-item-section
            q-item-label {{t(`admin.security.jwtAudience`)}}
            q-item-label(caption) {{t(`admin.security.jwtAudienceHint`)}}
          q-item-section(style='flex: 0 0 250px;')
            q-input(
              outlined
              v-model='state.config.authJwtAudience'
              dense
              :aria-label='t(`admin.security.jwtAudience`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='expired')
          q-item-section
            q-item-label {{t(`admin.security.tokenExpiration`)}}
            q-item-label(caption) {{t(`admin.security.tokenExpirationHint`)}}
          q-item-section(style='flex: 0 0 140px;')
            q-input(
              outlined
              v-model='state.config.authJwtExpiration'
              dense
              :aria-label='t(`admin.security.tokenExpiration`)'
              )
        q-separator.q-my-sm(inset)
        q-item
          blueprint-icon(icon='future')
          q-item-section
            q-item-label {{t(`admin.security.tokenRenewalPeriod`)}}
            q-item-label(caption) {{t(`admin.security.tokenRenewalPeriodHint`)}}
          q-item-section(style='flex: 0 0 140px;')
            q-input(
              outlined
              v-model='state.config.authJwtRenewablePeriod'
              dense
              :aria-label='t(`admin.security.tokenRenewalPeriod`)'
              )
</template>

<script setup>
import { cloneDeep } from 'lodash-es'
import gql from 'graphql-tag'
import filesize from 'filesize'
import filesizeParser from 'filesize-parser'

import { useI18n } from 'vue-i18n'
import { useMeta, useQuasar } from 'quasar'
import { computed, onMounted, reactive, watch } from 'vue'

import { useAdminStore } from 'src/stores/admin'
import { useSiteStore } from 'src/stores/site'

// QUASAR

const $q = useQuasar()

// STORES

const adminStore = useAdminStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.security.title')
})

// DATA

const state = reactive({
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
  humanUploadMaxFileSize: '0'
})

const hstsDurations = [
  { value: 300, text: '5 minutes' },
  { value: 86400, text: '1 day' },
  { value: 604800, text: '1 week' },
  { value: 2592000, text: '1 month' },
  { value: 31536000, text: '1 year' },
  { value: 63072000, text: '2 years' }
]

const corsModes = [
  { value: 'OFF', text: 'Off / Same-Origin' },
  { value: 'REFLECT', text: 'Reflect Request Origin' },
  { value: 'HOSTNAMES', text: 'Hostnames Whitelist' },
  { value: 'REGEX', text: 'Regex Pattern Match' }
]

// METHODS

async function load () {
  state.loading++
  $q.loading.show()
  const resp = await APOLLO_CLIENT.query({
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
  state.config = cloneDeep(resp?.data?.systemSecurity)
  state.humanUploadMaxFileSize = filesize(state.config.uploadMaxFileSize ?? 0, { base: 2, standard: 'jedec' })
  $q.loading.hide()
  state.loading--
}

async function save () {
  state.loading++
  try {
    const respRaw = await APOLLO_CLIENT.mutate({
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
        ...state.config,
        uploadMaxFileSize: filesizeParser(state.humanUploadMaxFileSize || '0')
      }
    })
    const resp = respRaw?.data?.updateSystemSecurity?.status || {}
    if (resp.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('admin.security.saveSuccess')
      })
    } else {
      throw new Error(resp.message)
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Failed to save security config',
      caption: err.message
    })
  }
  state.loading--
}

// MOUNTED

onMounted(() => {
  load()
})
</script>

<style lang='scss'>

</style>
