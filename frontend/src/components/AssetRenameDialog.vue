<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card class="relative" style="min-width: 650px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-rename.svg" size="sm" class="mr-2" />
        <span>{{ t(`fileman.assetRename`) }}</span>
      </w-card-section>
      <w-form class="py-2" @submit="rename">
        <w-item>
          <blueprint-icon icon="image" class="self-start" />
          <w-item-section>
            <w-input
              v-model="state.path"
              autofocus
              outlined
              dense
              hide-bottom-space
              :label="t(`fileman.assetFileName`)"
              :hint="t(`fileman.assetFileNameHint`)"
              lazy-rules="ondemand"
              @keyup:enter="rename" />
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
          :label="t(`common.actions.rename`)"
          color="primary"
          padding="xs md"
          :loading="state.loading > 0"
          @click="rename" />
      </w-card-actions>
      <w-inner-loading :showing="state.loading > 0" size="38px" spinner-class="text-accent" />
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
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

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

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

async function rename() {
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
    notify({
      type: 'positive',
      message: t('fileman.renameAssetSuccess')
    })
    onDialogOK()
  } catch (err) {
    // -> ky throws above 400 — a name already taken in this folder answers 409
    const apiMessage = await err.response
      ?.json()
      .then((b) => b?.message)
      .catch(() => null)
    notify({
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
    const apiMessage = await err.response
      ?.json()
      .then((b) => b?.message)
      .catch(() => null)
    notify({
      type: 'negative',
      message: apiMessage || err.message
    })
    onDialogCancel()
  }
  state.loading--
})
</script>
