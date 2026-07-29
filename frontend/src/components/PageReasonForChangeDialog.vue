<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="min-width: 450px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-query.svg" size="sm" class="mr-2" />
        <span>{{ t(`editor.reasonForChange.title`) }}</span>
      </w-card-section>
      <!-- -> `pb-0`: the row below pads itself and the field adds its own margin for the floating
           label, so the section's own 16px on top of those left the prompt adrift from its field -->
      <w-card-section class="pb-0">
        <div v-if="props.required" class="text-body2">
          {{ t(`editor.reasonForChange.required`) }}
        </div>
        <div v-else class="text-body2">{{ t(`editor.reasonForChange.optional`) }}</div>
      </w-card-section>
      <w-form ref="reasonForm" class="pb-2" @submit="commit">
        <w-item>
          <w-item-section>
            <w-input
              ref="iptReason"
              v-model="state.reason"
              outlined
              dense
              :rules="reasonValidation"
              hide-bottom-space
              :label="t(`editor.reasonForChange.field`)"
              lazy-rules="ondemand" />
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
import { computed, reactive, ref } from 'vue'

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

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent({
  autofocus: () => iptReason.value
})

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  reason: '',
  isLoading: false
})

// REFS

const reasonForm = ref(null)
const iptReason = ref(null)

// VALIDATION RULES

/*
  No rule at all when the reason is optional, rather than a rule the field is exempt from.

  WForm validates every registered field on submit and only emits `submit` if they all pass, so an
  unconditional rule made Enter on an empty field report a missing reason and swallow the submit --
  even though `commit()` itself only validates when the reason is required.
*/
const reasonValidation = computed(() =>
  props.required ? [(val) => val.length > 0 || t('editor.reasonForChange.reasonMissing')] : []
)

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
