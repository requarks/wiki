<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 450px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-query.svg', left, size='sm')
      span {{t(`editor.reasonForChange.title`)}}
    q-card-section
      .text-body2(v-if='props.required') {{t(`editor.reasonForChange.required`)}}
      .text-body2(v-else) {{t(`editor.reasonForChange.optional`)}}
    q-form.q-pb-sm(ref='reasonForm', @submit.prevent='commit')
      q-item
        q-item-section
          q-input(
            outlined
            v-model='state.reason'
            dense
            :rules='reasonValidation'
            hide-bottom-space
            :label='t(`editor.reasonForChange.field`)'
            :aria-label='t(`editor.reasonForChange.field`)'
            lazy-rules='ondemand'
            autofocus
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
        :label='t(`common.actions.save`)'
        color='primary'
        padding='xs md'
        @click='commit'
        :loading='state.isLoading'
        )
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
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

defineEmits([
  ...useDialogPluginComponent.emits
])

// QUASAR

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()
const $q = useQuasar()

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

const reasonValidation = [
  val => val.length > 0 || t('editor.reasonForChange.reasonMissing')
]

// METHODS

async function commit () {
  state.isLoading = true
  try {
    if (props.required) {
      const isFormValid = await reasonForm.value.validate(true)
      if (!isFormValid) {
        throw new Error('Form Invalid')
      }
    }
    onDialogOK({ reason: state.reason })
  } catch (err) { }
  state.isLoading = false
}
</script>
