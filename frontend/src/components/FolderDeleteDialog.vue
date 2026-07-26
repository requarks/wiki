<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 550px; max-width: 850px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-delete-bin.svg', left, size='sm')
      span {{t(`folderDeleteDialog.title`)}}
    q-card-section
      .text-body2
        i18n-t(keypath='folderDeleteDialog.confirm')
          template(v-slot:name)
            strong {{folderName}}
      .text-caption.text-grey.q-mt-sm {{t('folderDeleteDialog.folderId', { id: folderId })}}
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

import { useSiteStore } from '@/stores/site'

// PROPS

const props = defineProps({
  folderId: {
    type: String,
    required: true
  },
  folderName: {
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
  isLoading: false
})

// METHODS

async function confirm () {
  state.isLoading = true
  try {
    await API_CLIENT.delete(`sites/${siteStore.id}/tree/folders/${props.folderId}`)
    $q.notify({
      type: 'positive',
      message: t('folderDeleteDialog.deleteSuccess')
    })
    onDialogOK()
  } catch (err) {
    // -> ky throws above 400 — a folder deleted from another tab answers 404
    const apiMessage = await err.response?.json().then(b => b?.message).catch(() => null)
    $q.notify({
      type: 'negative',
      message: apiMessage || err.message
    })
  }
  state.isLoading = false
}
</script>
