<template>
  <w-dialog v-model="dialogVisible" @hide="onDialogHide">
    <w-card style="min-width: 450px">
      <w-card-section class="card-header">
        <w-icon name="img:/_assets/icons/fluent-plus-plus.svg" size="sm" class="mr-2" />
        <span>{{ t(`admin.groups.create`) }}</span>
      </w-card-section>
      <w-form ref="createGroupForm" class="py-2" @submit="create">
        <w-item>
          <blueprint-icon icon="team" />
          <w-item-section>
            <w-input
              v-model="state.groupName"
              outlined
              dense
              :rules="groupNameValidation"
              hide-bottom-space
              :label="t(`common.field.name`)"
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
          :label="t(`common.actions.create`)"
          color="primary"
          padding="xs md"
          :loading="state.isLoading"
          @click="create" />
      </w-card-actions>
    </w-card>
  </w-dialog>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

import { dialogComponentEmits, useDialogComponent } from '@/composables/dialog'
import { notify } from '@/composables/notify'
import { reactive, ref } from 'vue'

// EMITS

defineEmits([...dialogComponentEmits])

// DIALOG

const { dialogVisible, onDialogHide, onDialogOK, onDialogCancel } = useDialogComponent()

// I18N

const { t } = useI18n()

// DATA

const state = reactive({
  groupName: '',
  isLoading: false
})

// REFS

const createGroupForm = ref(null)

// VALIDATION RULES

const groupNameValidation = [
  (val) => val.length > 0 || t('admin.groups.nameMissing'),
  (val) => /^[^<>"]+$/.test(val) || t('admin.groups.nameInvalidChars')
]

// METHODS

async function create() {
  state.isLoading = true
  try {
    const isFormValid = await createGroupForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('admin.groups.createInvalidData'))
    }
    const resp = await API_CLIENT.post('groups', {
      json: {
        name: state.groupName
      }
    }).json()
    if (!resp?.ok) {
      throw new Error(
        t(`admin.groups.${resp?.error}`, resp?.message || 'An unexpected error occured.')
      )
    }
    notify({
      type: 'positive',
      message: t('admin.groups.createSuccess')
    })
    onDialogOK()
  } catch (err) {
    notify({
      type: 'negative',
      message: err.message
    })
  }
  state.isLoading = false
}
</script>
