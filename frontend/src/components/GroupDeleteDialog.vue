<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 350px; max-width: 450px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-delete-bin.svg', left, size='sm')
      span {{t(`admin.groups.delete`)}}
    q-card-section
      .text-body2
        i18n-t(keypath='admin.groups.deleteConfirm')
          template(#groupName)
            strong {{props.group.name}}
      .text-body2.q-mt-md
        strong.text-negative {{t(`admin.groups.deleteConfirmWarn`)}}
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
        )
</template>

<script setup>

import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'

// PROPS

const props = defineProps({
  group: {
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

// METHODS

async function confirm () {
  try {
    const resp = await API_CLIENT.delete(`groups/${props.group.id}`)
    if (!resp?.ok) {
      throw new Error((await resp.json())?.message || 'An unexpected error occured.')
    }
    $q.notify({
      type: 'positive',
      message: t('admin.groups.deleteSuccess')
    })
    onDialogOK()
  } catch (err) {
    // -> ky throws for statuses above 400 (e.g. 409 for a system group), where the reason the API
    //    gave is in the response body rather than in the error message
    const apiMessage = await err.response?.json().then(b => b?.message).catch(() => null)
    $q.notify({
      type: 'negative',
      message: apiMessage || err.message
    })
  }
}
</script>
