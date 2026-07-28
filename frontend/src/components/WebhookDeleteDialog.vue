<template>
  <w-dialog v-model="dialogVisible" max-width="450px" @hide="onDialogHide">
    <w-card style="min-width: 350px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-delete-bin.svg" size="sm" class="mr-2" />
        <span>{{ t(`admin.webhooks.delete`) }}</span>
      </w-card-section>
      <w-card-section>
        <div class="text-body2">
          <i18n-t keypath="admin.webhooks.deleteConfirm">
            <template #name>
              <strong>{{ hook.name }}</strong>
            </template>
          </i18n-t>
        </div>
        <div class="text-body2 mt-4">
          <strong class="text-negative">{{ t(`admin.webhooks.deleteConfirmWarn`) }}</strong>
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

// PROPS

const props = defineProps({
  hook: {
    type: Object,
    required: true
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

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
    const resp = await API_CLIENT.delete(`hooks/${props.hook.id}`)
    if (!resp?.ok) {
      throw new Error((await resp.json())?.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('admin.webhooks.deleteSuccess')
    })
    onDialogOK()
  } catch (err) {
    // -> ky throws above 400 — a webhook deleted from another tab answers 404
    const apiMessage = await err.response
      ?.json()
      .then((b) => b?.message)
      .catch(() => null)
    notify({
      type: 'negative',
      message: apiMessage || err.message
    })
  }
  state.isLoading = false
}
</script>
