<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="min-width: 650px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-password-reset.svg" size="sm" class="mr-2" />
        <span>{{ t(`admin.users.changePassword`) }}</span>
      </w-card-section>
      <w-form ref="changeUserPwdForm" class="py-2" @submit="save">
        <w-item>
          <blueprint-icon icon="lock" />
          <w-item-section>
            <w-input
              v-model="state.currentPassword"
              outlined
              dense
              type="password"
              autocomplete="current-password"
              :rules="currentPasswordValidation"
              hide-bottom-space
              :label="t(`auth.changePwd.currentPassword`)"
              lazy-rules="ondemand"
              autofocus />
          </w-item-section>
        </w-item>
        <w-item>
          <blueprint-icon icon="password" />
          <w-item-section>
            <w-input
              ref="newPasswordIpt"
              v-model="state.newPassword"
              outlined
              dense
              type="password"
              autocomplete="new-password"
              revealable
              :rules="newPasswordValidation"
              hide-bottom-space
              :label="t(`auth.changePwd.newPassword`)"
              lazy-rules="ondemand">
              <template #append>
                <div class="flex flex-nowrap items-center">
                  <w-badge :color="passwordStrength.color" :label="passwordStrength.label" />
                  <w-separator vertical class="mx-2 self-stretch" />
                  <w-btn flat dense padding="none xs" color="brown" @click="randomizePassword">
                    <w-icon name="la:dice-d6" />
                    <div class="pl-1 text-caption"><strong>Generate</strong></div>
                  </w-btn>
                </div>
              </template>
            </w-input>
          </w-item-section>
        </w-item>
        <w-item>
          <blueprint-icon icon="good-pincode" />
          <w-item-section>
            <w-input
              v-model="state.verifyPassword"
              outlined
              dense
              type="password"
              autocomplete="new-password"
              :rules="verifyPasswordValidation"
              hide-bottom-space
              :label="t(`auth.changePwd.newPasswordVerify`)"
              lazy-rules="ondemand" />
          </w-item-section>
        </w-item>
      </w-form>
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
          :label="t(`common.actions.update`)"
          color="primary"
          padding="xs md"
          :loading="state.isLoading"
          @click="save" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import zxcvbn from 'zxcvbn'
import { sampleSize } from 'es-toolkit/array'
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'
import { localizeError } from '@/helpers/localization'
import { computed, reactive, ref } from 'vue'

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
  currentPassword: '',
  newPassword: '',
  verifyPassword: '',
  isLoading: false
})

// REFS

const changeUserPwdForm = ref(null)
const newPasswordIpt = ref(null)

// COMPUTED

const passwordStrength = computed(() => {
  if (state.newPassword.length < 8) {
    return {
      color: 'negative',
      label: t('admin.users.pwdStrengthWeak')
    }
  } else {
    switch (zxcvbn(state.newPassword).score) {
      case 1:
        return {
          color: 'deep-orange-7',
          label: t('admin.users.pwdStrengthPoor')
        }
      case 2:
        return {
          color: 'purple-7',
          label: t('admin.users.pwdStrengthMedium')
        }
      case 3:
        return {
          color: 'blue-7',
          label: t('admin.users.pwdStrengthGood')
        }
      case 4:
        return {
          color: 'green-7',
          label: t('admin.users.pwdStrengthStrong')
        }
      default:
        return {
          color: 'negative',
          label: t('admin.users.pwdStrengthWeak')
        }
    }
  }
})

// VALIDATION RULES

const currentPasswordValidation = [(val) => val.length > 0 || t('auth.errors.missingPassword')]
const newPasswordValidation = [
  (val) => val.length > 0 || t('auth.errors.missingPassword'),
  (val) => val.length >= 8 || t('auth.errors.passwordTooShort')
]
const verifyPasswordValidation = [
  (val) => val.length > 0 || t('auth.errors.missingVerifyPassword'),
  (val) => val === state.newPassword || t('auth.errors.passwordsNotMatch')
]

// METHODS

function randomizePassword() {
  const pwdChars = 'abcdefghkmnpqrstuvwxyzABCDEFHJKLMNPQRSTUVWXYZ23456789_*=?#!()+'
  state.newPassword = sampleSize([...pwdChars], 16).join('')
  // -> A password the user never typed has to be readable, or there is no way to record it anywhere
  newPasswordIpt.value.reveal()
}

async function save() {
  state.isLoading = true
  try {
    const isFormValid = await changeUserPwdForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('auth.errors.fields'))
    }
    const resp = await API_CLIENT.put('users/profile/password', {
      json: {
        strategyId: props.strategyId,
        currentPassword: state.currentPassword,
        newPassword: state.newPassword
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(localizeError(resp?.message, t) || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('auth.changePwd.success')
    })
    onDialogOK()
  } catch (err) {
    notify({
      type: 'negative',
      message: localizeError(apiErrorMessage(err), t)
    })
  }
  state.isLoading = false
}
</script>
