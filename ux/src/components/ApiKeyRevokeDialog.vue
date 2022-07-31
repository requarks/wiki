<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 350px; max-width: 450px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-unavailable.svg', left, size='sm')
      span {{t(`admin.api.revokeConfirm`)}}
    q-card-section
      .text-body2
        i18n-t(keypath='admin.api.revokeConfirmText')
          template(#name)
            strong {{apiKey.name}}
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
        :label='t(`admin.api.revoke`)'
        color='negative'
        padding='xs md'
        @click='confirm'
        :loading='state.isLoading'
        )
</template>

<script setup>
import gql from 'graphql-tag'
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { reactive } from 'vue'

// PROPS

const props = defineProps({
  apiKey: {
    type: Object,
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
  isLoading: false
})

// METHODS

async function confirm () {
  state.isLoading = true
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation revokeApiKey ($id: UUID!) {
          revokeApiKey (id: $id) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        id: props.apiKey.id
      }
    })
    if (resp?.data?.revokeApiKey?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('admin.api.revokeSuccess')
      })
      onDialogOK()
    } else {
      throw new Error(resp?.data?.revokeApiKey?.operation?.message || 'An unexpected error occured.')
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
