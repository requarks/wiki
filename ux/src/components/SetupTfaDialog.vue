<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 650px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-password-reset.svg', left, size='sm')
      span {{t(`admin.users.changePassword`)}}
    q-form.q-py-sm(ref='changeUserPwdForm', @submit='save')
      q-item
        blueprint-icon(icon='lock')
        q-item-section
          q-input(
            outlined
            v-model='state.currentPassword'
            dense
            :rules='currentPasswordValidation'
            hide-bottom-space
            :label='t(`auth.changePwd.currentPassword`)'
            :aria-label='t(`auth.changePwd.currentPassword`)'
            lazy-rules='ondemand'
            autofocus
            )
      q-item
        blueprint-icon(icon='password')
        q-item-section
          q-input(
            outlined
            v-model='state.newPassword'
            dense
            :rules='newPasswordValidation'
            hide-bottom-space
            :label='t(`auth.changePwd.newPassword`)'
            :aria-label='t(`auth.changePwd.newPassword`)'
            lazy-rules='ondemand'
            autofocus
            )
            template(#append)
              .flex.items-center
                q-badge(
                  :color='passwordStrength.color'
                  :label='passwordStrength.label'
                )
                q-separator.q-mx-sm(vertical)
                q-btn(
                  flat
                  dense
                  padding='none xs'
                  color='brown'
                  @click='randomizePassword'
                  )
                  q-icon(name='las la-dice-d6')
                  .q-pl-xs.text-caption: strong Generate
      q-item
        blueprint-icon(icon='good-pincode')
        q-item-section
          q-input(
            outlined
            v-model='state.verifyPassword'
            dense
            :rules='verifyPasswordValidation'
            hide-bottom-space
            :label='t(`auth.changePwd.newPasswordVerify`)'
            :aria-label='t(`auth.changePwd.newPasswordVerify`)'
            lazy-rules='ondemand'
            autofocus
            )
    q-card-actions.card-actions
      q-space
      q-btn.acrylic-btn(
        flat
        :label='t(`common.actions.cancel`)'
        color='grey'
        padding='xs md'
        @click='onDialogCancel'
        )
      q-btn(
        unelevated
        :label='t(`common.actions.update`)'
        color='primary'
        padding='xs md'
        @click='save'
        :loading='state.isLoading'
        )
</template>

<script setup>
import gql from 'graphql-tag'
import zxcvbn from 'zxcvbn'
import { sampleSize } from 'lodash-es'
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { computed, reactive, ref } from 'vue'

import { useSiteStore } from 'src/stores/site'

// PROPS

const props = defineProps({
  strategyId: {
    type: String,
    required: true
  }
})

// EMITS

defineEmits([
  ...useDialogPluginComponent.emits
])

// QUASAR

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
const $q = useQuasar()

// STORES

const siteStore = useSiteStore()

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

const currentPasswordValidation = [
  val => val.length > 0 || t('auth.errors.missingPassword')
]
const newPasswordValidation = [
  val => val.length > 0 || t('auth.errors.missingPassword'),
  val => val.length >= 8 || t('auth.errors.passwordTooShort')
]
const verifyPasswordValidation = [
  val => val.length > 0 || t('auth.errors.missingVerifyPassword'),
  val => val === state.newPassword || t('auth.errors.passwordsNotMatch')
]

// METHODS

function randomizePassword () {
  const pwdChars = 'abcdefghkmnpqrstuvwxyzABCDEFHJKLMNPQRSTUVWXYZ23456789_*=?#!()+'
  state.newPassword = sampleSize(pwdChars, 16).join('')
}

async function save () {
  state.isLoading = true
  try {
    const isFormValid = await changeUserPwdForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('auth.errors.fields'))
    }
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation changePwd (
          $currentPassword: String
          $newPassword: String!
          $strategyId: UUID!
          $siteId: UUID!
          ) {
          changePassword (
            currentPassword: $currentPassword
            newPassword: $newPassword
            strategyId: $strategyId
            siteId: $siteId
            ) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        currentPassword: state.currentPassword,
        newPassword: state.newPassword,
        strategyId: props.strategyId,
        siteId: siteStore.id
      }
    })
    if (resp?.data?.changePassword?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('auth.changePwd.success')
      })
      onDialogOK()
    } else {
      throw new Error(resp?.data?.changePassword?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
  state.isLoading = false
}
</script>
