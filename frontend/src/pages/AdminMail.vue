<template>
  <w-page class="admin-mail">
    <div class="flex flex-wrap p-4 items-center">
      <div class="flex-none">
        <img
          class="admin-icon animated fadeInLeft"
          src="/_assets/icons/fluent-message-settings-animated.svg" />
      </div>
      <div class="min-w-0 flex-1 pl-4">
        <div class="text-h5 text-primary animated fadeInLeft">{{ t('admin.mail.title') }}</div>
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
                outlined
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
                outlined
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
                outlined
                v-model="state.config.defaultBaseURL"
                dense
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
                outlined
                v-model="state.config.host"
                dense
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
                outlined
                v-model="state.config.port"
                dense
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
            <blueprint-icon icon="test-account" />
            <w-item-section>
              <w-item-label>{{ t(`admin.mail.smtpUser`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.mail.smtpUserHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-input
                outlined
                v-model="state.config.user"
                dense
                :aria-label="t(`admin.mail.smtpUser`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="password" />
            <w-item-section>
              <w-item-label>{{ t(`admin.mail.smtpPwd`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.mail.smtpPwdHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-input
                outlined
                v-model="state.config.pass"
                dense
                :aria-label="t(`admin.mail.smtpPwd`)" />
            </w-item-section>
          </w-item>
          <w-separator class="my-2" inset />
          <w-item>
            <blueprint-icon icon="server" />
            <w-item-section>
              <w-item-label>{{ t(`admin.mail.smtpName`) }}</w-item-label>
              <w-item-label caption>{{ t(`admin.mail.smtpNameHint`) }}</w-item-label>
            </w-item-section>
            <w-item-section>
              <w-input
                outlined
                v-model="state.config.name"
                dense
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
                  outlined
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
                  outlined
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
                <w-input
                  outlined
                  v-model="state.config.dkimPrivateKey"
                  dense
                  :aria-label="t(`admin.mail.dkimPrivateKey`)"
                  type="textarea" />
              </w-item-section>
            </w-item>
          </template>
        </w-card>
      </div>
      <div class="col-span-12 lg:col-span-5">
        <!-- ----------------------- -->
        <!-- MAIL TEMPLATES -->
        <!-- ----------------------- -->
        <w-card class="pb-2 mb-4" v-if="flagStore.experimental">
          <w-card-header>{{ t('admin.mail.templates') }}</w-card-header>
          <w-list>
            <w-item>
              <blueprint-icon icon="resume-template" />
              <w-item-section>
                <w-item-label>{{ t(`admin.mail.templateWelcome`) }}</w-item-label>
              </w-item-section>
              <w-item-section side>
                <w-btn
                  outline
                  no-caps
                  icon="la:edit"
                  color="primary"
                  @click="editTemplate(`welcome`)"
                  :label="t(`common.actions.edit`)" />
              </w-item-section>
            </w-item>
            <w-separator inset />
            <w-item>
              <blueprint-icon icon="resume-template" />
              <w-item-section>
                <w-item-label>{{ t(`admin.mail.templateResetPwd`) }}</w-item-label>
              </w-item-section>
              <w-item-section side>
                <w-btn
                  outline
                  no-caps
                  icon="la:edit"
                  color="primary"
                  @click="editTemplate(`pwdreset`)"
                  :label="t(`common.actions.edit`)" />
              </w-item-section>
            </w-item>
          </w-list>
        </w-card>
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
                outlined
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
import { onMounted, reactive } from 'vue'

import { useMeta } from '@/composables/meta'
import { notify } from '@/composables/notify'

import { useAdminStore } from '@/stores/admin'
import { useFlagsStore } from '@/stores/flags'
import { useSiteStore } from '@/stores/site'

import { toMerged } from 'es-toolkit/object'

// STORES

const adminStore = useAdminStore()
const flagStore = useFlagsStore()
const siteStore = useSiteStore()

// I18N

const { t } = useI18n()

// META

useMeta({
  title: t('admin.mail.title')
})

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
    user: '',
    pass: '',
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

// METHODS
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
        user: state.config.user || '',
        pass: state.config.pass || '',
        useDKIM: state.config.useDKIM ?? false,
        dkimDomainName: state.config.dkimDomainName || '',
        dkimKeySelector: state.config.dkimKeySelector || '',
        dkimPrivateKey: state.config.dkimPrivateKey || ''
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(
        t(`admin.mail.${resp?.error}`, resp?.message || 'An unexpected error occured.')
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

function editTemplate(tmplId) {
  adminStore.$patch({
    overlayOpts: { id: tmplId },
    overlay: 'MailTemplateEditorOverlay'
  })
}

function sendTest() {
  // TODO: the backend has no SMTP transport yet, so there is nothing to send the test email with.
  // Only the mail configuration itself is wired up (GET / PUT /_api/mail/config).
  notify({
    type: 'warning',
    message: t('admin.mail.sendTestUnavailable')
  })
}

// MOUNTED

onMounted(() => {
  load()
})
</script>

<style lang="scss"></style>
