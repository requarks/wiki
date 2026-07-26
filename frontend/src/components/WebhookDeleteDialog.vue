<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 350px; max-width: 450px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-delete-bin.svg', left, size='sm')
      span {{t(`admin.webhooks.delete`)}}
    q-card-section
      .text-body2
        i18n-t(keypath='admin.webhooks.deleteConfirm')
          template(v-slot:name)
            strong {{hook.name}}
      .text-body2.q-mt-md
        strong.text-negative {{t(`admin.webhooks.deleteConfirmWarn`)}}
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
        :label='t(`common.actions.delete`)'
        color='negative'
        padding='xs md'
        @click='confirm'
        :loading='state.isLoading'
        )
</template>

<script setup>

import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { reactive } from 'vue'

// PROPS

const props = defineProps({
  hook: {
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
    const resp = await API_CLIENT.delete(`hooks/${props.hook.id}`)
    if (!resp?.ok) {
      throw new Error((await resp.json())?.message || 'An unexpected error occured.')
    }
    $q.notify({
      type: 'positive',
      message: t('admin.webhooks.deleteSuccess')
    })
    onDialogOK()
  } catch (err) {
    // -> ky throws above 400 — a webhook deleted from another tab answers 404
    const apiMessage = await err.response?.json().then(b => b?.message).catch(() => null)
    $q.notify({
      type: 'negative',
      message: apiMessage || err.message
    })
  }
  state.isLoading = false
}
</script>
