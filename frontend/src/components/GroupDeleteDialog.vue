<template>
  <w-dialog v-model="dialogVisible" max-width="450px" @hide="onDialogHide">
    <w-card style="min-width: 350px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-delete-bin.svg" size="sm" class="mr-2" />
        <span>{{ t(`admin.groups.delete`) }}</span>
      </w-card-section>
      <w-card-section>
        <div class="text-body2">
          <i18n-t keypath="admin.groups.deleteConfirm">
            <template #groupName>
              <strong>{{ props.group.name }}</strong>
            </template>
          </i18n-t>
        </div>
        <div class="text-body2 mt-4">
          <strong class="text-negative">{{ t(`admin.groups.deleteConfirmWarn`) }}</strong>
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
          @click="confirm" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { apiErrorMessage } from '@/helpers/apiError'

// PROPS

const props = defineProps({
  group: {
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

// METHODS

async function confirm() {
  try {
    const resp = await API_CLIENT.delete(`groups/${props.group.id}`)
    if (!resp?.ok) {
      throw new Error((await resp.json())?.message || 'An unexpected error occured.')
    }
    notify({
      type: 'positive',
      message: t('admin.groups.deleteSuccess')
    })
    onDialogOK()
  } catch (err) {
    // -> ky throws for statuses above 400 (e.g. 409 for a system group), where the reason the API
    //    gave is in the response body rather than in the error message
    notify({
      type: 'negative',
      message: apiErrorMessage(err)
    })
  }
}
</script>
