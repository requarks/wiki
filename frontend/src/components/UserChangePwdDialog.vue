<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="min-width: 650px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-password-reset.svg" size="sm" class="mr-2" />
        <span>{{ t(`admin.users.changePassword`) }}</span>
      </w-card-section>
      <w-form ref="changeUserPwdForm" class="py-2" @submit="save">
        <w-item>
          <blueprint-icon icon="password" />
          <w-item-section>
            <w-input
              v-model="state.userPassword"
              outlined
              dense
              :rules="userPasswordValidation"
              hide-bottom-space
              :label="t(`admin.users.password`)"
              lazy-rules="ondemand"
              autofocus>
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
        <!--
          The whole row is the toggle's hit area, as it was when this was a <label>-tagged item.
          `@click.stop` on the toggle keeps a direct hit on the switch from also firing the row
          handler and cancelling itself out.
        -->
        <w-item clickable @click="state.userMustChangePassword = !state.userMustChangePassword">
          <blueprint-icon icon="password-reset" />
          <w-item-section>
            <w-item-label>{{ t(`admin.users.mustChangePwd`) }}</w-item-label>
            <w-item-label caption>{{ t(`admin.users.mustChangePwdHint`) }}</w-item-label>
          </w-item-section>
          <w-item-section avatar>
            <w-toggle
              v-model="state.userMustChangePassword"
              :aria-label="t(`admin.users.mustChangePwd`)"
              @click.stop />
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
import { sampleSize } from 'es-toolkit/array'
import zxcvbn from 'zxcvbn'

import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'
import { computed, reactive, ref } from 'vue'

// PROPS

const props = defineProps({
  userId: {
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
  userPassword: '',
  userMustChangePassword: false,
  isLoading: false
})

// REFS

const changeUserPwdForm = ref(null)

// COMPUTED

const passwordStrength = computed(() => {
  if (state.userPassword.length < 8) {
    return {
      color: 'negative',
      label: t('admin.users.pwdStrengthWeak')
    }
  } else {
    switch (zxcvbn(state.userPassword).score) {
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

const userPasswordValidation = [
  (val) => val.length > 0 || t('admin.users.passwordMissing'),
  (val) => val.length >= 8 || t('admin.users.passwordTooShort')
]

// METHODS

function randomizePassword() {
  const pwdChars = 'abcdefghkmnpqrstuvwxyzABCDEFHJKLMNPQRSTUVWXYZ23456789_*=?#!()+'
  state.userPassword = sampleSize(pwdChars, 16).join('')
}

async function save() {
  state.isLoading = true
  try {
    const isFormValid = await changeUserPwdForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('admin.users.createInvalidData'))
    }
    const resp = await API_CLIENT.put(`users/${props.userId}/password`, {
      json: {
        newPassword: state.userPassword,
        mustChangePassword: state.userMustChangePassword
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(
        t(`admin.users.${resp?.error}`, resp?.message || 'An unexpected error occured.')
      )
    }
    notify({
      type: 'positive',
      message: t('admin.users.changePasswordSuccess')
    })
    onDialogOK({
      mustChangePassword: state.userMustChangePassword
    })
  } catch (err) {
    // -> ky throws above 400 with the reason in the body, which is where the server explains itself
    notify({
      type: 'negative',
      message: apiErrorMessage(err, 'An unexpected error occured.')
    })
  }
  state.isLoading = false
}
</script>
