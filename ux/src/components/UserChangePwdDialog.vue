<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 650px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-password-reset.svg', left, size='sm')
      span {{t(`admin.users.changePassword`)}}
    q-form.q-py-sm(ref='changeUserPwdForm', @submit='save')
      q-item
        blueprint-icon(icon='password')
        q-item-section
          q-input(
            outlined
            v-model='state.userPassword'
            dense
            :rules='userPasswordValidation'
            hide-bottom-space
            :label='t(`admin.users.password`)'
            :aria-label='t(`admin.users.password`)'
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
      q-item(tag='label', v-ripple)
        blueprint-icon(icon='password-reset')
        q-item-section
          q-item-label {{t(`admin.users.mustChangePwd`)}}
          q-item-label(caption) {{t(`admin.users.mustChangePwdHint`)}}
        q-item-section(avatar)
          q-toggle(
            v-model='state.userMustChangePassword'
            color='primary'
            checked-icon='las la-check'
            unchecked-icon='las la-times'
            :aria-label='t(`admin.users.mustChangePwd`)'
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
import sampleSize from 'lodash/sampleSize'
import zxcvbn from 'zxcvbn'

import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { computed, reactive, ref } from 'vue'

// PROPS

const props = defineProps({
  userId: {
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
  val => val.length > 0 || t('admin.users.passwordMissing'),
  val => val.length >= 8 || t('admin.users.passwordTooShort')
]

// METHODS

function randomizePassword () {
  const pwdChars = 'abcdefghkmnpqrstuvwxyzABCDEFHJKLMNPQRSTUVWXYZ23456789_*=?#!()+'
  state.userPassword = sampleSize(pwdChars, 16).join('')
}

async function save () {
  state.isLoading = true
  try {
    const isFormValid = await changeUserPwdForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('admin.users.createInvalidData'))
    }
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation adminUpdateUserPwd (
          $id: UUID!
          $patch: UserUpdateInput!
          ) {
          updateUser (
            id: $id
            patch: $patch
            ) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        id: props.userId,
        patch: {
          newPassword: state.userPassword,
          mustChangePassword: state.userMustChangePassword
        }
      }
    })
    if (resp?.data?.updateUser?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('admin.users.createSuccess')
      })
      onDialogOK({
        mustChangePassword: state.userMustChangePassword
      })
    } else {
      throw new Error(resp?.data?.updateUser?.operation?.message || 'An unexpected error occured.')
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
