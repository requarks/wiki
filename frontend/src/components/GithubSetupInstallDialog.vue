<template>
  <w-dialog v-model="dialogVisible" max-width="550px" persistent @hide="onDialogHide">
    <w-card style="min-width: 350px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/ultraviolet-github.svg" size="sm" class="mr-2" />
        <span>{{ t(`admin.storage.githubSetupInstallApp`) }}</span>
      </w-card-section>
      <w-card-section>
        <div class="text-body2">{{ t(`admin.storage.githubSetupInstallAppInfo`) }}</div>
        <div class="text-body2 mt-4">
          <strong class="text-deep-orange">{{
            t('admin.storage.githubSetupInstallAppSelect')
          }}</strong>
        </div>
        <div class="text-body2 mt-4">{{ t(`admin.storage.githubSetupInstallAppReturn`) }}</div>
      </w-card-section>
      <w-card-actions class="card-actions">
        <w-space />
        <w-btn
          unelevated
          :label="t(`admin.storage.githubSetupContinue`)"
          color="positive"
          padding="xs md"
          @click="onDialogOK" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK } = useDialogComponent()

// I18N

const { t } = useI18n()
</script>
