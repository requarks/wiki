<template>
  <w-dialog v-model="dialogVisible" persistent @hide="onDialogHide">
    <w-card style="min-width: 450px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-fingerprint.svg" size="sm" class="mr-2" />
        <span>{{ t(`profile.authSetTfa`) }}</span>
      </w-card-section>
      <template v-if="!state.isInit">
        <w-linear-progress query color="positive" />
        <w-card-section class="text-center text-grey">
          {{ t(`profile.authSetTfaLoading`) }}
        </w-card-section>
      </template>
      <template v-else>
        <w-card-section class="relative text-center">
          <p>{{ t('auth.tfaSetupInstrFirst') }}</p>
          <div style="justify-content: center; display: flex">
            <!-- eslint-disable-next-line vue/no-v-html -- server-generated QR code SVG -->
            <div v-html="state.tfaQRImage" style="width: 200px" />
          </div>
          <!--
            The same secret in text, for an authenticator app that is not on the device showing this,
            or a user who would rather type it than point a camera at the screen. Grouped in fours to
            be readable; the copy button copies it without the spaces.
          -->
          <div class="mt-2 text-caption text-grey">{{ t('auth.tfaSetupInstrManual') }}</div>
          <div class="mt-1 flex items-center justify-center gap-2">
            <code class="rounded bg-black/6 px-2 py-1 font-mono text-body2 dark:bg-white/10">{{
              groupedSecret
            }}</code>
            <w-btn
              class="acrylic-btn"
              flat
              dense
              icon="la:copy"
              :aria-label="t(`common.actions.copy`)"
              color="primary"
              @click="copySecret" />
          </div>
          <p class="mt-4">{{ t('auth.tfaSetupInstrSecond') }}</p>
          <div class="flex flex-wrap justify-center">
            <v-otp-input
              v-model:value="state.securityCode"
              :num-inputs="6"
              :should-auto-focus="true"
              input-classes="otp-input"
              input-type="number"
              separator="" />
          </div>
          <w-inner-loading :showing="state.isLoading" />
        </w-card-section>
        <w-card-actions class="card-actions">
          <w-space />
          <w-btn
            class="acrylic-btn"
            flat
            :label="t(`common.actions.cancel`)"
            color="grey"
            padding="xs md"
            @click="onDialogCancel" />
          <w-btn
            unelevated
            :label="t(`auth.tfa.verifyToken`)"
            color="primary"
            padding="xs md"
            :loading="state.isLoading"
            @click="save" />
        </w-card-actions>
      </template>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'
import { copyToClipboard } from '@/helpers/clipboard'
import { localizeError } from '@/helpers/localization'
import { computed, onMounted, reactive } from 'vue'

import VOtpInput from 'vue3-otp-input'

// PROPS

const props = defineProps({
  strategyId: {
    type: String,
    required: true
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  isInit: false,
  isLoading: false,
  securityCode: '',
  tfaQRImage: '',
  tfaSecret: '',
  continuationToken: ''
})

// COMPUTED

/** The secret in groups of four, which is how a 32-character string stays readable to type. */
const groupedSecret = computed(() => state.tfaSecret.replace(/.{4}(?=.)/g, '$& '))

// METHODS

async function copySecret() {
  try {
    // -> Without the display grouping: a space is harmless in most authenticator apps, but not all
    await copyToClipboard(state.tfaSecret)
    notify({
      type: 'positive',
      message: t('auth.tfaSetupKeyCopied')
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('auth.tfaSetupKeyCopyFailed'),
      caption: err.message
    })
  }
}

async function load() {
  state.isInit = false
  try {
    const resp = await API_CLIENT.post('users/profile/tfa', {
      json: {
        strategyId: props.strategyId
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(localizeError(resp?.message, t) || 'An unexpected error occured.')
    }
    state.continuationToken = resp.continuationToken
    state.tfaQRImage = resp.tfaQRImage
    state.tfaSecret = resp.tfaSecret
    state.isInit = true
  } catch (err) {
    notify({
      type: 'negative',
      message: apiErrorMessage(err)
    })
    onDialogCancel()
  }
}

async function save() {
  state.isLoading = true
  try {
    if (!/^[0-9]{6}$/.test(state.securityCode)) {
      throw new Error(t('auth.errors.tfaMissing'))
    }
    const resp = await API_CLIENT.put('users/profile/tfa', {
      json: {
        strategyId: props.strategyId,
        continuationToken: state.continuationToken,
        securityCode: state.securityCode
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(localizeError(resp?.message, t) || t('auth.errors.loginError'))
    }
    state.continuationToken = ''
    state.securityCode = ''
    notify({
      type: 'positive',
      message: t('auth.tfaSetupSuccess')
    })
    state.isLoading = false
    onDialogOK()
  } catch (err) {
    notify({
      type: 'negative',
      message: apiErrorMessage(err)
    })
  }
  state.isLoading = false
}

onMounted(() => {
  load()
})
</script>
