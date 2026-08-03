<template>
  <w-dialog v-model="dialogVisible" max-width="850px" @hide="onDialogHide">
    <w-card style="min-width: 550px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-delete-bin.svg" size="sm" class="mr-2" />
        <span>{{ t(`fileman.assetDelete`) }}</span>
      </w-card-section>
      <w-card-section>
        <div class="text-body2">
          <i18n-t keypath="fileman.assetDeleteConfirm">
            <template #name>
              <strong>{{ assetName }}</strong>
            </template>
          </i18n-t>
        </div>
        <div class="text-caption text-grey mt-2">
          {{ t('fileman.assetDeleteId', { id: assetId }) }}
        </div>
      </w-card-section>
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
          :label="t(`common.actions.delete`)"
          color="negative"
          padding="xs md"
          :loading="state.isLoading"
          @click="confirm" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { reactive } from 'vue'

import { useSiteStore } from '@/stores/site'
import { apiErrorMessage } from '@/helpers/apiError'

// PROPS

const props = defineProps({
  assetId: {
    type: String,
    required: true
  },
  assetName: {
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
  isLoading: false
})

// METHODS

async function confirm() {
  state.isLoading = true
  try {
    await API_CLIENT.delete(`sites/${siteStore.id}/assets/${props.assetId}`)
    notify({
      type: 'positive',
      message: t('fileman.assetDeleteSuccess')
    })
    onDialogOK()
  } catch (err) {
    // -> ky throws above 400 — an asset deleted from another tab answers 404
    notify({
      type: 'negative',
      message: apiErrorMessage(err)
    })
  }
  state.isLoading = false
}
</script>
