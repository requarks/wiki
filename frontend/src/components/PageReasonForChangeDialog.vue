<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="min-width: 450px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-query.svg" size="sm" class="mr-2" />
        <span>{{ t(`editor.reasonForChange.title`) }}</span>
      </w-card-section>
      <w-card-section>
        <div v-if="props.required" class="text-body2">
          {{ t(`editor.reasonForChange.required`) }}
        </div>
        <div v-else class="text-body2">{{ t(`editor.reasonForChange.optional`) }}</div>
      </w-card-section>
      <w-form ref="reasonForm" class="pb-2" @submit="commit">
        <w-item>
          <w-item-section>
            <w-input
              v-model="state.reason"
              outlined
              dense
              :rules="reasonValidation"
              hide-bottom-space
              :label="t(`editor.reasonForChange.field`)"
              lazy-rules="ondemand"
              autofocus />
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
          :label="t(`common.actions.save`)"
          color="primary"
          padding="xs md"
          :loading="state.isLoading"
          @click="commit" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { reactive, ref } from 'vue'

// PROPS

const props = defineProps({
  required: {
    type: Boolean,
    required: false,
    default: false
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
  reason: '',
  isLoading: false
})

// REFS

const reasonForm = ref(null)

// VALIDATION RULES

const reasonValidation = [(val) => val.length > 0 || t('editor.reasonForChange.reasonMissing')]

// METHODS

async function commit() {
  state.isLoading = true
  try {
    if (props.required) {
      const isFormValid = await reasonForm.value.validate(true)
      if (!isFormValid) {
        throw new Error('Form Invalid')
      }
    }
    onDialogOK({ reason: state.reason })
  } catch (err) {}
  state.isLoading = false
}
</script>
