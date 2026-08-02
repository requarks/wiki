<template>
  <w-page class="admin-mail">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img class="admin-icon animated fadeInLeft" src="/_assets/icons/fluent-protect.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.security.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.security.subtitle') }}
        </div>
      </div>
      <div class="flex-none">
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/system/security`"
          target="_blank">
          <w-tooltip>{{ t(`common.actions.viewDocs`) }}</w-tooltip>
        </w-btn>
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:redo-alt"
          flat
          color="secondary"
          :loading="state.loading > 0"
          :aria-label="t(`common.actions.refresh`)"
          @click="load">
          <w-tooltip>{{ t(`common.actions.refresh`) }}</w-tooltip>
        </w-btn>
        <w-btn
          unelevated
          icon="mdi:check"
          :label="t(`common.actions.apply`)"
          color="secondary"
          @click="save"
          :loading="state.loading > 0" />
      </div>
    </div>
    <w-separator inset />
    <div class="grid grid-cols-12 p-4 gap-4">
      <div class="col-span-12 lg:col-span-6">
        <!-- ----------------------- -->
        <!-- Security -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>{{ t('admin.security.title') }}</w-card-header>
          <w-item class="pt-0">
            <w-item-section>
              <w-card class="bg-negative text-white rounded" flat>
                <w-card-section class="items-center" horizontal>
                  <w-card-section class="flex-none pr-0">
                    <w-icon name="la:exclamation-triangle" size="lg" />
                  </w-card-section>
                  <w-card-section class="text-caption">
                    <div>{{ t('admin.security.warn') }}</div>
                    <!-- These are read when the HTTP server builds its plugin chain, not per request -->
                    <div class="mt-1">{{ t('admin.security.restartRequired') }}</div>
                  </w-card-section>
                </w-card-section>
              </w-card>
            </w-item-section>
          </w-item>
          <w-item tag="label">
            <blueprint-icon icon="rfid-signal" />
            <w-item-section>
              <w-item-label>{{ t(`admin.security.disallowFloc`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.security.disallowFlocHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.disallowFloc"
                :aria-label="t(`admin.security.disallowFloc`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="maximize-window" />
            <w-item-section>
              <w-item-label>{{ t(`admin.security.disallowIframe`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.security.disallowIframeHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.disallowIframe"
                :aria-label="t(`admin.security.disallowIframe`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="do-not-touch" />
            <w-item-section>
              <w-item-label>{{ t(`admin.security.enforceSameOriginReferrerPolicy`) }}</w-item-label>
              <w-item-label caption>{{
                t(`admin.security.enforceSameOriginReferrerPolicyHint`)
              }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.enforceSameOriginReferrerPolicy"
                :aria-label="t(`admin.security.enforceSameOriginReferrerPolicy`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="curly-arrow" />
            <w-item-section>
              <w-item-label>{{ t(`admin.security.disallowOpenRedirect`) }}</w-item-label>
              <w-item-label caption>{{
                t(`admin.security.disallowOpenRedirectHint`)
              }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.disallowOpenRedirect"
                :aria-label="t(`admin.security.disallowOpenRedirect`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="download-from-cloud" />
            <w-item-section>
              <w-item-label>{{ t(`admin.security.forceAssetDownload`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.security.forceAssetDownloadHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.forceAssetDownload"
                :aria-label="t(`admin.security.forceAssetDownload`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="door-sensor-alarmed" />
            <w-item-section>
              <w-item-label>{{ t(`admin.security.trustProxy`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.security.trustProxyHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.trustProxy"
                :aria-label="t(`admin.security.trustProxy`)" />
            </w-item-section>
          </w-item>
        </w-card>
        <!-- ----------------------- -->
        <!-- HSTS -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4">
          <w-card-header>{{ t('admin.security.hsts') }}</w-card-header>
          <w-item tag="label">
            <blueprint-icon icon="hips" />
            <w-item-section>
              <w-item-label>{{ t(`admin.security.enforceHsts`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.security.enforceHstsHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.enforceHsts"
                :aria-label="t(`admin.security.enforceHsts`)" />
            </w-item-section>
          </w-item>
          <template v-if="state.config.enforceHsts">
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="timer" />
              <w-item-section>
                <w-item-label>{{ t(`admin.security.hstsDuration`) }}</w-item-label>
                <w-item-label caption>{{ t(`admin.security.hstsDurationHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section style="flex: 0 0 200px">
                <w-select
                  outlined
                  v-model="state.config.hstsDuration"
                  :options="hstsDurations"
                  option-value="value"
                  option-label="text"
                  emit-value
                  map-options
                  dense
                  :aria-label="t(`admin.security.hstsDuration`)" />
              </w-item-section>
            </w-item>
          </template>
        </w-card>
        <!-- ----------------------- -->
        <!-- Rate Limiting -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4">
          <w-card-header>{{ t('admin.security.rateLimit') }}</w-card-header>
          <!--
            First thing in the card, and in the same red the security warning above uses: both say
            something that decides whether the settings under them do what they look like they do.
          -->
          <w-item class="pt-0">
            <w-item-section>
              <w-card class="bg-negative text-white rounded" flat>
                <w-card-section class="items-center" horizontal>
                  <w-card-section class="flex-none pr-0">
                    <w-icon name="la:exclamation-triangle" size="lg" />
                  </w-card-section>
                  <w-card-section class="text-caption">
                    <!-- -> With `trustProxy` off behind a proxy every request carries the proxy's
                         address, so one visitor going over the limit takes everybody with them -->
                    <div v-if="!state.config.trustProxy">
                      {{ t('admin.security.rateLimitProxyWarn') }}
                    </div>
                    <div :class="{ 'mt-1': !state.config.trustProxy }">
                      {{ t('admin.security.rateLimitRecommended') }}
                    </div>
                  </w-card-section>
                </w-card-section>
              </w-card>
            </w-item-section>
          </w-item>
          <w-item tag="label">
            <blueprint-icon icon="filtration" />
            <w-item-section>
              <w-item-label>{{ t(`admin.security.rateLimitEnabled`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.security.rateLimitEnabledHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.authRateLimitEnabled"
                :aria-label="t(`admin.security.rateLimitEnabled`)" />
            </w-item-section>
          </w-item>
          <template v-if="state.config.authRateLimitEnabled">
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="pin-pad" />
              <w-item-section>
                <w-item-label>{{ t(`admin.security.rateLimitMax`) }}</w-item-label>
                <w-item-label caption>{{ t(`admin.security.rateLimitMaxHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section style="flex: 0 0 200px">
                <w-input
                  outlined
                  v-model.number="state.config.authRateLimitMax"
                  dense
                  :suffix="t(`admin.security.rateLimitMaxSuffix`)"
                  :aria-label="t(`admin.security.rateLimitMax`)" />
              </w-item-section>
            </w-item>
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="timer" />
              <w-item-section>
                <w-item-label>{{ t(`admin.security.rateLimitWindow`) }}</w-item-label>
                <w-item-label caption>{{ t(`admin.security.rateLimitWindowHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section style="flex: 0 0 200px">
                <w-input
                  outlined
                  v-model="state.config.authRateLimitWindow"
                  dense
                  :placeholder="t(`admin.security.durationPlaceholder`)"
                  :aria-label="t(`admin.security.rateLimitWindow`)" />
              </w-item-section>
            </w-item>
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="denied" />
              <w-item-section>
                <w-item-label>{{ t(`admin.security.rateLimitBan`) }}</w-item-label>
                <w-item-label caption>{{ t(`admin.security.rateLimitBanHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section style="flex: 0 0 200px">
                <w-input
                  outlined
                  v-model="state.config.authRateLimitBan"
                  dense
                  :placeholder="t(`admin.security.durationPlaceholder`)"
                  :aria-label="t(`admin.security.rateLimitBan`)" />
              </w-item-section>
            </w-item>
          </template>
        </w-card>
      </div>
      <div class="col-span-12 lg:col-span-6">
        <!-- ----------------------- -->
        <!-- Uploads -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>{{ t('admin.security.uploads') }}</w-card-header>
          <w-item class="pt-0">
            <w-item-section>
              <w-card class="bg-info text-white rounded" flat>
                <w-card-section class="items-center" horizontal>
                  <w-card-section class="flex-none pr-0">
                    <w-icon name="la:info-circle" size="lg" />
                  </w-card-section>
                  <w-card-section class="text-caption">
                    <div>{{ t('admin.security.uploadsInfo') }}</div>
                    <!-- Saved, but nothing reads them: there is no upload endpoint yet -->
                    <div class="mt-1">{{ t('admin.security.uploadsNotEnforced') }}</div>
                  </w-card-section>
                </w-card-section>
              </w-card>
            </w-item-section>
          </w-item>
          <w-item>
            <blueprint-icon icon="upload-to-the-cloud" />
            <w-item-section>
              <w-item-label>{{ t(`admin.security.maxUploadSize`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.security.maxUploadSizeHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section style="flex: 0 0 200px">
              <w-input
                outlined
                v-model.number="state.humanUploadMaxFileSize"
                dense
                :aria-label="t(`admin.security.maxUploadSize`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="upload-to-ftp" />
            <w-item-section>
              <w-item-label>{{ t(`admin.security.maxUploadBatch`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.security.maxUploadBatchHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section style="flex: 0 0 200px">
              <w-input
                outlined
                v-model.number="state.config.uploadMaxFiles"
                dense
                :suffix="t(`admin.security.maxUploadBatchSuffix`)"
                :aria-label="t(`admin.security.maxUploadBatch`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="scan-stock" />
            <w-item-section>
              <w-item-label>{{ t(`admin.security.scanSVG`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.security.scanSVGHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.uploadScanSVG"
                :aria-label="t(`admin.security.scanSVG`)" />
            </w-item-section>
          </w-item>
        </w-card>
        <!-- ----------------------- -->
        <!-- CORS -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4">
          <w-card-header>{{ t('admin.security.cors') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="firewall" />
            <w-item-section>
              <w-item-label>{{ t(`admin.security.corsMode`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.security.corsModeHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-select
                outlined
                v-model="state.config.corsMode"
                :options="corsModes"
                option-value="value"
                option-label="text"
                emit-value
                map-options
                dense
                :aria-label="t(`admin.security.corsMode`)" />
            </w-item-section>
          </w-item>
          <template v-if="state.config.corsMode === `HOSTNAMES`">
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="todo-list" key="corsHostnames" />
              <w-item-section>
                <w-item-label>{{ t(`admin.security.corsHostnames`) }}</w-item-label>
                <w-item-label caption>{{ t(`admin.security.corsHostnamesHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section>
                <w-input
                  outlined
                  v-model="state.config.corsConfig"
                  dense
                  type="textarea"
                  :aria-label="t(`admin.security.corsHostnames`)" />
              </w-item-section>
            </w-item>
          </template>
          <template v-else-if="state.config.corsMode === `REGEX`">
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="validation" key="corsRegex" />
              <w-item-section>
                <w-item-label>{{ t(`admin.security.corsRegex`) }}</w-item-label>
                <w-item-label caption>{{ t(`admin.security.corsRegexHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section>
                <w-input
                  outlined
                  v-model="state.config.corsConfig"
                  dense
                  :aria-label="t(`admin.security.corsRegex`)" />
              </w-item-section>
            </w-item>
          </template>
        </w-card>
        <!-- ----------------------- -->
        <!-- JWT -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4">
          <w-card-header>{{ t('admin.security.jwt') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="ticket" />
            <w-item-section>
              <w-item-label>{{ t(`admin.security.jwtAudience`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.security.jwtAudienceHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section style="flex: 0 0 250px">
              <w-input
                outlined
                v-model="state.config.authJwtAudience"
                dense
                :aria-label="t(`admin.security.jwtAudience`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="expired" />
            <w-item-section>
              <w-item-label>{{ t(`admin.security.tokenExpiration`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.security.tokenExpirationHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section style="flex: 0 0 140px">
              <w-input
                outlined
                v-model="state.config.authJwtExpiration"
                dense
                :aria-label="t(`admin.security.tokenExpiration`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="future" />
            <w-item-section>
              <w-item-label>{{ t(`admin.security.tokenRenewalPeriod`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.security.tokenRenewalPeriodHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section style="flex: 0 0 140px">
              <w-input
                outlined
                v-model="state.config.authJwtRenewablePeriod"
                dense
                :aria-label="t(`admin.security.tokenRenewalPeriod`)" />
            </w-item-section>
          </w-item>
        </w-card>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { onMounted, reactive } from 'vue'

import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { loading } from '@/composables/loading'

import { useSiteStore } from '@/stores/site'

import { filesize } from 'filesize'
import filesizeParser from 'filesize-parser'

// STORES

const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.security.title')
})

// DATA

const state = reactive({
  loading: 0,
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
    authRateLimitEnabled: true,
    authRateLimitMax: 10,
    authRateLimitWindow: '5m',
    authRateLimitBan: '15m',
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

async function load() {
  state.loading++
  loading.show()
  try {
    const resp = await API_CLIENT.get('system/security').json()
    state.config = { ...state.config, ...resp }
    state.humanUploadMaxFileSize = filesize(state.config.uploadMaxFileSize ?? 0, {
      base: 2,
      standard: 'jedec'
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.security.loadFailed'),
      caption: err.message
    })
  }
  loading.hide()
  state.loading--
}

async function save() {
  state.loading++
  try {
    let uploadMaxFileSize
    try {
      uploadMaxFileSize = filesizeParser(state.humanUploadMaxFileSize || '0')
    } catch {
      throw new Error(t('admin.security.maxUploadSizeInvalid'))
    }
    if (!(uploadMaxFileSize > 0)) {
      throw new Error(t('admin.security.maxUploadSizeInvalid'))
    }

    const resp = await API_CLIENT.put('system/security', {
      json: {
        ...state.config,
        uploadMaxFileSize
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('admin.security.saveSuccess')
    })
    await load()
  } catch (err) {
    // -> ky throws above 400 — the server rejects combinations that would store a setting doing
    //    nothing, e.g. enforcing a CSP with no directives
    const apiMessage = await err.response
      ?.json()
      .then((b) => b?.message)
      .catch(() => null)
    notify({
      type: 'negative',
      message: t('admin.security.saveFailed'),
      caption: apiMessage || err.message
    })
  }
  state.loading--
}

// MOUNTED

onMounted(() => {
  load()
})
</script>

<style lang="scss"></style>
