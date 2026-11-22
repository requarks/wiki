<template>
  <w-page class="admin-mail">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img
          class="admin-icon animated fadeInLeft"
          src="/_assets/icons/fluent-message-settings-animated.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 admin-page-title animated fadeInLeft">{{ t('admin.mail.title') }}</div>
        <div class="text-subtitle1 text-grey animated fadeInLeft wait-p2s">
          {{ t('admin.mail.subtitle') }}
        </div>
      </div>
      <div class="flex-none">
        <w-btn
          class="mr-2 acrylic-btn"
          icon="la:question-circle"
          flat
          color="grey"
          :aria-label="t(`common.actions.viewDocs`)"
          :href="siteStore.docsBase + `/admin/mail`"
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
          :disabled="state.loading > 0" />
      </div>
    </div>
    <w-separator inset />
    <div class="grid grid-cols-12 p-4 gap-4">
      <div class="col-span-12 lg:col-span-7">
        <!-- ----------------------- -->
        <!-- Configuration -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>{{ t('admin.mail.configuration') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="contact" />
            <w-item-section>
              <w-item-label>{{ t(`admin.mail.senderName`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.senderNameHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-input
                v-model="state.config.senderName"
                dense
                hide-bottom-space
                :aria-label="t(`admin.mail.senderName`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="envelope" />
            <w-item-section>
              <w-item-label>{{ t(`admin.mail.senderEmail`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.senderEmailHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-input
                v-model="state.config.senderEmail"
                dense
                :aria-label="t(`admin.mail.senderEmail`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="dns" />
            <w-item-section>
              <w-item-label>{{ t(`admin.mail.defaultBaseURL`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.general.defaultBaseURLHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-input
                v-model="state.config.defaultBaseURL"
                dense
                placeholder="https://wiki.example.com"
                :aria-label="t(`admin.mail.defaultBaseURL`)" />
            </w-item-section>
          </w-item>
        </w-card>
        <!-- ----------------------- -->
        <!-- SMTP -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4">
          <w-card-header>{{ t('admin.mail.smtp') }}</w-card-header>
          <w-item>
            <blueprint-icon icon="dns" />
            <w-item-section>
              <w-item-label>{{ t(`admin.mail.smtpHost`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.mail.smtpHostHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-input
                v-model="state.config.host"
                dense
                no-autofill
                hide-bottom-space
                :aria-label="t(`admin.mail.smtpHost`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="ethernet-off" />
            <w-item-section>
              <w-item-label>{{ t(`admin.mail.smtpPort`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.mail.smtpPortHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section style="flex: 0 0 120px">
              <w-input
                v-model="state.config.port"
                dense
                no-autofill
                :aria-label="t(`admin.mail.smtpPort`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="secure" />
            <w-item-section>
              <w-item-label>{{ t(`admin.mail.smtpTLS`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.mail.smtpTLSHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle v-model="state.config.secure" :aria-label="t(`admin.mail.smtpTLS`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item tag="label">
            <blueprint-icon icon="security-ssl" />
            <w-item-section>
              <w-item-label>{{ t(`admin.mail.smtpVerifySSL`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.mail.smtpVerifySSLHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle
                v-model="state.config.verifySSL"
                :aria-label="t(`admin.mail.smtpVerifySSL`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="access" />
            <w-item-section>
              <w-item-label>{{ t(`admin.mail.smtpAuth`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.mail.smtpAuthHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-select
                :model-value="state.config.authType"
                :options="authTypeOptions"
                emit-value
                map-options
                dense
                hide-bottom-space
                :aria-label="t(`admin.mail.smtpAuth`)"
                @update:model-value="setAuthType" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="test-account" />
            <w-item-section>
              <w-item-label>{{
                t(isOAuth ? `admin.mail.oauthMailbox` : `admin.mail.smtpUser`)
              }}</w-item-label>
              <w-item-label caption>{{
                t(isOAuth ? `admin.mail.oauthMailboxHint` : `admin.mail.smtpUserHint`)
              }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-input
                v-model="state.config.user"
                dense
                no-autofill
                :placeholder="isOAuth ? state.config.senderEmail : undefined"
                :aria-label="t(isOAuth ? `admin.mail.oauthMailbox` : `admin.mail.smtpUser`)" />
            </w-item-section>
          </w-item>
          <template v-if="state.config.authType === 'microsoft'">
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="microsoft" />
              <w-item-section>
                <w-item-label>{{ t(`admin.mail.msTenantId`) }}</w-item-label>
                <w-item-label caption>{{ t(`admin.mail.msTenantIdHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section>
                <w-input
                  v-model="state.config.msTenantId"
                  dense
                  no-autofill
                  :aria-label="t(`admin.mail.msTenantId`)" />
              </w-item-section>
            </w-item>
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="key" />
              <w-item-section>
                <w-item-label>{{ t(`admin.mail.msClientId`) }}</w-item-label>
                <w-item-label caption>{{ t(`admin.mail.msClientIdHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section>
                <w-input
                  v-model="state.config.msClientId"
                  dense
                  no-autofill
                  :aria-label="t(`admin.mail.msClientId`)" />
              </w-item-section>
            </w-item>
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="password" />
              <w-item-section>
                <w-item-label>{{ t(`admin.mail.msClientSecret`) }}</w-item-label>
                <w-item-label caption>{{ t(`admin.mail.msClientSecretHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section>
                <!-- -> Arrives masked, as the password does; see below -->
                <w-input
                  v-model="state.config.msClientSecret"
                  dense
                  type="password"
                  revealable
                  no-autofill
                  :aria-label="t(`admin.mail.msClientSecret`)" />
              </w-item-section>
            </w-item>
          </template>
          <template v-else-if="state.config.authType === 'google'">
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="google" />
              <w-item-section>
                <w-item-label>{{ t(`admin.mail.googleServiceAccount`) }}</w-item-label>
                <w-item-label caption>{{ t(`admin.mail.googleServiceAccountHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section>
                <w-input
                  v-model="state.config.googleServiceAccount"
                  dense
                  no-autofill
                  :aria-label="t(`admin.mail.googleServiceAccount`)" />
              </w-item-section>
            </w-item>
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="grand-master-key" />
              <w-item-section>
                <w-item-label>{{ t(`admin.mail.googlePrivateKey`) }}</w-item-label>
                <w-item-label caption>{{ t(`admin.mail.googlePrivateKeyHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section>
                <!-- -> Arrives masked like the password; the mask posted back keeps the stored key -->
                <w-input
                  v-model="state.config.googlePrivateKey"
                  dense
                  no-autofill
                  :aria-label="t(`admin.mail.googlePrivateKey`)"
                  type="textarea" />
              </w-item-section>
            </w-item>
          </template>
          <template v-else>
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="password" />
              <w-item-section>
                <w-item-label>{{ t(`admin.mail.smtpPwd`) }}</w-item-label>
                <w-item-label caption>{{ t(`admin.mail.smtpPwdHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section>
                <!-- -> Masked, with WInput's own reveal toggle: what arrives from the server is a mask
                        rather than the password, so the only value ever readable here is one the
                        operator is typing at that moment and may want to check -->
                <w-input
                  v-model="state.config.pass"
                  dense
                  type="password"
                  revealable
                  no-autofill
                  :aria-label="t(`admin.mail.smtpPwd`)" />
              </w-item-section>
            </w-item>
          </template>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="server" />
            <w-item-section>
              <w-item-label>{{ t(`admin.mail.smtpName`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.mail.smtpNameHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-input
                v-model="state.config.name"
                dense
                no-autofill
                hide-bottom-space
                :aria-label="t(`admin.mail.smtpName`)" />
            </w-item-section>
          </w-item>
        </w-card>
        <!-- ----------------------- -->
        <!-- DKIM -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mt-4">
          <w-card-header>{{ t('admin.mail.dkim') }}</w-card-header>
          <w-item class="pt-0">
            <w-item-section>
              <w-card class="bg-info text-white rounded" flat>
                <w-card-section class="items-center" horizontal>
                  <w-card-section class="flex-none pr-0">
                    <w-icon name="la:info-circle" size="lg" />
                  </w-card-section>
                  <w-card-section class="text-caption">{{
                    t('admin.mail.dkimHint')
                  }}</w-card-section>
                </w-card-section>
              </w-card>
            </w-item-section>
          </w-item>
          <w-item tag="label">
            <blueprint-icon icon="received" />
            <w-item-section>
              <w-item-label>{{ t(`admin.mail.dkimUse`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.mail.dkimUseHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section avatar>
              <w-toggle v-model="state.config.useDKIM" :aria-label="t(`admin.mail.dkimUse`)" />
            </w-item-section>
          </w-item>
          <template v-if="state.config.useDKIM">
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="dns" />
              <w-item-section>
                <w-item-label>{{ t(`admin.mail.dkimDomainName`) }}</w-item-label>
                <w-item-label caption>{{ t(`admin.mail.dkimDomainNameHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section>
                <w-input
                  v-model="state.config.dkimDomainName"
                  dense
                  :aria-label="t(`admin.mail.dkimDomainName`)" />
              </w-item-section>
            </w-item>
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="access" />
              <w-item-section>
                <w-item-label>{{ t(`admin.mail.dkimKeySelector`) }}</w-item-label>
                <w-item-label caption>{{ t(`admin.mail.dkimKeySelectorHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section>
                <w-input
                  v-model="state.config.dkimKeySelector"
                  dense
                  :aria-label="t(`admin.mail.dkimKeySelector`)" />
              </w-item-section>
            </w-item>
            <w-separator class="my-2" inset />
            <w-item>
              <blueprint-icon icon="grand-master-key" />
              <w-item-section>
                <w-item-label>{{ t(`admin.mail.dkimPrivateKey`) }}</w-item-label>
                <w-item-label caption>{{ t(`admin.mail.dkimPrivateKeyHint`) }}</w-item-label>
              </w-item-section>
              <w-item-section>
                <!-- -> Arrives masked like the password; the mask posted back keeps the stored key -->
                <w-input
                  v-model="state.config.dkimPrivateKey"
                  dense
                  no-autofill
                  :aria-label="t(`admin.mail.dkimPrivateKey`)"
                  type="textarea" />
              </w-item-section>
            </w-item>
          </template>
        </w-card>
      </div>
      <div class="col-span-12 lg:col-span-5">
        <!-- ----------------------- -->
        <!-- SMTP TEST -->
        <!-- ----------------------- -->
        <w-card class="pb-2">
          <w-card-header>{{ t('admin.mail.test') }}</w-card-header>
          <w-item>
            <blueprint-icon class="self-start" icon="email" />
            <w-item-section>
              <w-item-label>{{ t(`admin.mail.testRecipient`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.mail.testRecipientHint`) }}</w-item-label>
              <w-input
                class="mt-4"
                v-model="state.testEmail"
                dense
                :aria-label="t(`admin.mail.testRecipient`)" />
            </w-item-section>
          </w-item>
          <div class="flex justify-end pr-4 py-2">
            <w-btn
              unelevated
              color="primary"
              icon="la:paper-plane"
              :label="t(`admin.mail.testSend`)"
              @click="sendTest"
              :loading="state.testLoading" />
          </div>
        </w-card>
      </div>
    </div>
  </w-page>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { computed, onMounted, reactive } from 'vue'

import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'
import { apiErrorMessage, apiFailureMessage } from '@/helpers/apiError'

import { useAdminStore } from '@/stores/admin'
import { useCommonStore } from '@/stores/common'
import { useSiteStore } from '@/stores/site'

import { toMerged } from 'es-toolkit/object'

// STORES

const adminStore = useAdminStore()
const commonStore = useCommonStore()
const siteStore = useSiteStore()

// I18N

const { t, te } = useI18n()

// META

useMeta(() => ({
  title: t('admin.mail.title')
}))

// DATA

/**
 * Fallbacks for config keys the API may not return yet, so that every control renders with a
 * defined value. Must mirror the mail defaults seeded by the backend.
 */
function defaultConfig() {
  return {
    senderName: '',
    senderEmail: '',
    defaultBaseURL: '',
    host: '',
    port: 465,
    name: '',
    secure: true,
    verifySSL: true,
    authType: 'basic',
    user: '',
    pass: '',
    msTenantId: '',
    msClientId: '',
    msClientSecret: '',
    googleServiceAccount: '',
    googlePrivateKey: '',
    useDKIM: false,
    dkimDomainName: '',
    dkimKeySelector: '',
    dkimPrivateKey: ''
  }
}

const state = reactive({
  config: defaultConfig(),
  testEmail: '',
  testLoading: false,
  loading: 0
})

const authTypeOptions = computed(() => [
  { label: t('admin.mail.smtpAuthBasic'), value: 'basic' },
  { label: t('admin.mail.smtpAuthMicrosoft'), value: 'microsoft' },
  { label: t('admin.mail.smtpAuthGoogle'), value: 'google' }
])

const isOAuth = computed(() => state.config.authType !== 'basic')

/**
 * Where each OAuth2 provider takes SMTP submissions, filled in on choosing it while no host is set
 * yet. Exchange Online only takes OAuth2 over STARTTLS on 587; Gmail takes it on 465 as well.
 */
const AUTH_TYPE_SERVERS = {
  microsoft: { host: 'smtp.office365.com', port: 587, secure: false },
  google: { host: 'smtp.gmail.com', port: 465, secure: true }
}

// METHODS

function setAuthType(authType) {
  state.config.authType = authType
  const server = AUTH_TYPE_SERVERS[authType]
  if (server && !state.config.host?.trim()) {
    Object.assign(state.config, server)
  }
}

async function load() {
  state.loading++
  try {
    const resp = await API_CLIENT.get('mail/config').json()
    if (!resp) {
      throw new Error('Failed to fetch mail config.')
    }
    state.config = toMerged(defaultConfig(), resp)
    adminStore.info.isMailConfigured = state.config?.host?.length > 2
  } catch (err) {
    notify({
      type: 'negative',
      message: 'Failed to fetch mail config',
      caption: err.message
    })
  }
  state.loading--
}

async function save() {
  if (state.loading > 0) {
    return
  }

  state.loading++
  try {
    const resp = await API_CLIENT.put('mail/config', {
      json: {
        senderName: state.config.senderName || '',
        senderEmail: state.config.senderEmail || '',
        defaultBaseURL: state.config.defaultBaseURL || '',
        host: state.config.host || '',
        port: Number.parseInt(state.config.port, 10) || 465,
        name: state.config.name || '',
        secure: state.config.secure ?? false,
        verifySSL: state.config.verifySSL ?? false,
        authType: state.config.authType || 'basic',
        user: state.config.user || '',
        pass: state.config.pass || '',
        msTenantId: state.config.msTenantId || '',
        msClientId: state.config.msClientId || '',
        msClientSecret: state.config.msClientSecret || '',
        googleServiceAccount: state.config.googleServiceAccount || '',
        googlePrivateKey: state.config.googlePrivateKey || '',
        useDKIM: state.config.useDKIM ?? false,
        dkimDomainName: state.config.dkimDomainName || '',
        dkimKeySelector: state.config.dkimKeySelector || '',
        dkimPrivateKey: state.config.dkimPrivateKey || ''
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(
        apiFailureMessage(resp, {
          t,
          te,
          prefix: 'admin.mail',
          fallback: 'An unexpected error occured.'
        })
      )
    }
    notify({
      type: 'positive',
      message: t('admin.mail.saveSuccess')
    })
    adminStore.info.isMailConfigured = state.config?.host?.length > 2
  } catch (err) {
    notify({
      type: 'negative',
      message: err.message
    })
  }
  state.loading--
}

async function sendTest() {
  if (!state.testEmail) {
    notify({
      type: 'negative',
      message: t('admin.mail.testRecipientMissing')
    })
    return
  }
  state.testLoading = true
  try {
    // -> The stored configuration is what it sends through, so anything typed above and not yet
    //    saved is not what is being tested
    const resp = await API_CLIENT.post('mail/test', {
      json: {
        recipient: state.testEmail,
        // -> The language the admin area is being read in, so that the test is also a look at what
        //    the templates say in it
        locale: commonStore.locale
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(resp?.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('admin.mail.sendTestSuccess')
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.mail.sendTestFailed'),
      // -> The mail server's own complaint, which is the whole value of the button
      caption: apiErrorMessage(err)
    })
  }
  state.testLoading = false
}

// MOUNTED

onMounted(() => {
  load()
})
</script>

<style lang="scss"></style>
