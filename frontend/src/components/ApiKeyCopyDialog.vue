<template>
  <w-dialog v-model="dialogVisible" persistent @hide="onDialogHide">
    <w-card style="min-width: 600px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-key-2.svg" size="sm" class="mr-2" />
        <span>{{ t(`admin.api.copyKeyTitle`) }}</span>
      </w-card-section>
      <w-card-section class="card-negative">
        <i18n-t tag="span" keypath="admin.api.newKeyCopyWarn" scope="global">
          <template #bold>
            <strong>{{ t('admin.api.newKeyCopyWarnBold') }}</strong>
          </template>
        </i18n-t>
      </w-card-section>
      <w-form class="py-2">
        <w-item>
          <blueprint-icon icon="binary-file" class="self-start" />
          <w-item-section>
            <w-input
              type="textarea"
              outlined
              :model-value="props.keyValue"
              readonly
              dense
              hide-bottom-space
              :label="t(`admin.api.key`)"
              autofocus />
          </w-item-section>
        </w-item>
      </w-form>
      <w-card-actions class="card-actions">
        <w-space />
        <!--
          The dialog is the only place this token ever appears, so copying it must not depend on
          selecting a wrapped 700-character string by hand
        -->
        <w-btn
          class="acrylic-btn"
          flat
          icon="la:copy"
          :label="t(`common.actions.copy`)"
          color="primary"
          padding="xs md"
          @click="copyKey" />
        <w-btn
          unelevated
          :label="t(`common.actions.close`)"
          color="primary"
          padding="xs md"
          @click="onDialogOK" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { copyToClipboard } from '@/helpers/clipboard'

// PROPS

const props = defineProps({
  keyValue: {
    type: String,
    required: true
  }
})

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK } = useDialogComponent()

// I18N

const { t } = useI18n()

// METHODS

async function copyKey() {
  try {
    await copyToClipboard(props.keyValue)
    notify({
      type: 'positive',
      message: t('admin.api.copySuccess')
    })
  } catch (err) {
    notify({
      type: 'negative',
      message: t('admin.api.copyFailed'),
      caption: err.message
    })
  }
}
</script>
