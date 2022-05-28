<template lang="pug">
q-dialog(ref='dialogRef', @hide='onDialogHide')
  q-card(style='min-width: 450px;')
    q-card-section.card-header
      q-icon(name='img:/_assets/icons/fluent-plus-plus.svg', left, size='sm')
      span {{t(`admin.groups.create`)}}
    q-form.q-py-sm(ref='createGroupForm', @submit='create')
      q-item
        blueprint-icon(icon='team')
        q-item-section
          q-input(
            outlined
            v-model='state.groupName'
            dense
            :rules='groupNameValidation'
            hide-bottom-space
            :label='t(`common.field.name`)'
            :aria-label='t(`common.field.name`)'
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
        :label='t(`common.actions.create`)'
        color='primary'
        padding='xs md'
        @click='create'
        :loading='state.isLoading'
        )
</template>

<script setup>
import gql from 'graphql-tag'
import { useI18n } from 'vue-i18n'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { reactive, ref } from 'vue'

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
  groupName: '',
  isLoading: false
})

// REFS

const createGroupForm = ref(null)

// VALIDATION RULES

const groupNameValidation = [
  val => val.length > 0 || t('admin.groups.nameMissing'),
  val => /^[^<>"]+$/.test(val) || t('admin.groups.nameInvalidChars')
]

// METHODS

async function create () {
  state.isLoading = true
  try {
    const isFormValid = await createGroupForm.value.validate(true)
    if (!isFormValid) {
      throw new Error(t('admin.groups.createInvalidData'))
    }
    const resp = await APOLLO_CLIENT.mutate({
      mutation: gql`
        mutation createGroup (
          $name: String!
          ) {
          createGroup(
            name: $name
            ) {
            operation {
              succeeded
              message
            }
          }
        }
      `,
      variables: {
        name: state.groupName
      }
    })
    if (resp?.data?.createGroup?.operation?.succeeded) {
      $q.notify({
        type: 'positive',
        message: t('admin.groups.createSuccess')
      })
      onDialogOK()
    } else {
      throw new Error(resp?.data?.createGroup?.operation?.message || 'An unexpected error occured.')
    }
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: err.message
    })
  }
  state.isLoading = false
}
</script>
