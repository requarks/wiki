<template lang='pug'>
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 650px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-rename.svg', left, size='sm')
      span {{ t(`fileman.assetRename`) }}
    q-form.q-py-sm(@submit='rename')
      q-item
        blueprint-icon.self-start(icon='image')
        q-item-section
          q-input(
            autofocus
            outlined
            v-model='state.path'
            dense
            hide-bottom-space
            :label='t(`fileman.assetFileName`)'
            :aria-label='t(`fileman.assetFileName`)'
            :hint='t(`fileman.assetFileNameHint`)'
            lazy-rules='ondemand'
            @keyup.enter='rename'
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
        :label='t(`common.actions.rename`)'
        color='primary'
        padding='xs md'
        @click='rename'
        :loading='state.loading > 0'
        )
    q-inner-loading(:showing='state.loading > 0')
      q-spinner(color='accent', size='lg')
</template>

<script setup>

import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { onMounted, reactive } from 'vue'

import { useSiteStore } from '@/stores/site'

// PROPS

const props = defineProps({
  assetId: {
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
  path: '',
  loading: false
})

// METHODS

async function rename () {
  state.loading++
  try {
    if (state.path?.length < 2 || !state.path?.includes('.')) {
      throw new Error(t('fileman.renameAssetInvalid'))
    }
    const resp = await API_CLIENT.patch(`sites/${siteStore.id}/assets/${props.assetId}`, {
      json: {
        fileName: state.path
      }
    }).json()
    // -> The API client does not throw on 400, so a refused name comes back as a parsed error
    if (resp?.ok === false) {
      throw new Error(resp.message || 'An unexpected error occured.')
    }
    $q.notify({
      type: 'positive',
      message: t('fileman.renameAssetSuccess')
    })
    onDialogOK()
  } catch (err) {
    // -> ky throws above 400 — a name already taken in this folder answers 409
    const apiMessage = await err.response?.json().then(b => b?.message).catch(() => null)
    $q.notify({
      type: 'negative',
      message: apiMessage || err.message
    })
  }
  state.loading--
}

// MOUNTED

onMounted(async () => {
  state.loading++
  try {
    const asset = await API_CLIENT.get(`sites/${siteStore.id}/assets/${props.assetId}`).json()
    if (asset?.id !== props.assetId) {
      throw new Error('Failed to fetch asset data.')
    }
    state.path = asset.fileName
  } catch (err) {
    const apiMessage = await err.response?.json().then(b => b?.message).catch(() => null)
    $q.notify({
      type: 'negative',
      message: apiMessage || err.message
    })
    onDialogCancel()
  }
  state.loading--
})
</script>
