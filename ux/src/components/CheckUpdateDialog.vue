<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 350px; max-width: 450px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-downloading-updates.svg', left, size='sm')
      span {{t(`admin.system.checkingForUpdates`)}}
    q-card-section
      .q-pa-md.text-center
        img(src='/_assets/illustrations/undraw_going_up.svg', style='width: 150px;')
      q-linear-progress(
        indeterminate
        size='lg'
        rounded
        )
      .q-mt-sm.text-center.text-caption Fetching latest version info...
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
        v-if='state.canUpgrade'
        unelevated
        :label='t(`admin.system.upgrade`)'
        color='primary'
        padding='xs md'
        @click='upgrade'
        :loading='state.isLoading'
        )
</template>

<script setup>
import gql from 'graphql-tag'
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { reactive } from 'vue'

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
  isLoading: false,
  canUpgrade: false
})

// METHODS

async function upgrade () {
  state.isLoading = true
  try {
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation deleteHook ($id: UUID!) {
          deleteHook(id: $id) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        id: 0
      }
    })
    if (resp?.data?.deleteHook?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('admin.webhooks.deleteSuccess')
      })
      onDialogOK()
    } else {
      throw new Error(resp?.data?.deleteHook?.operation?.message || 'An unexpected error occured.')
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
